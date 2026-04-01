/**
 * CookieGhost — Popup UI logic
 */

const api = typeof browser !== 'undefined' ? browser : chrome;

// DOM elements
const enableToggle = document.getElementById('enableToggle');
const ghostIcon = document.getElementById('ghostIcon');
const statRandomized = document.getElementById('statRandomized');
const statPreserved = document.getElementById('statPreserved');
const currentDomain = document.getElementById('currentDomain');
const siteRandomized = document.getElementById('siteRandomized');
const sitePreserved = document.getElementById('sitePreserved');
const activityFeed = document.getElementById('activityFeed');
const whitelistBtn = document.getElementById('whitelistBtn');
const blacklistBtn = document.getElementById('blacklistBtn');
const settingsBtn = document.getElementById('settingsBtn');
const dashboardBtn = document.getElementById('dashboardBtn');
const modeBtns = document.querySelectorAll('.mode-btn');

let activeDomain = '';
let currentWhitelist = [];
let currentBlacklist = [];

// Initialize popup
async function init() {
  try {
    // Get current tab domain
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url) {
      try {
        activeDomain = new URL(tabs[0].url).hostname;
        currentDomain.textContent = activeDomain;
      } catch {
        currentDomain.textContent = '—';
      }
    }

    // Get status from background
    const status = await api.runtime.sendMessage({ type: 'getStatus' });
    if (status) {
      enableToggle.checked = status.enabled;
      updateBodyState(status.enabled);
      setActiveMode(status.mode);
      updateSessionStats(status.stats);
    }

    // Get site-specific stats
    if (activeDomain) {
      const siteData = await api.runtime.sendMessage({
        type: 'getSiteStats',
        domain: activeDomain,
      });
      if (siteData && siteData.stats) {
        siteRandomized.textContent = siteData.stats.randomized;
        sitePreserved.textContent = siteData.stats.preserved;
      }
    }

    // Get whitelist/blacklist state
    const settings = await api.runtime.sendMessage({ type: 'getSettings' });
    if (settings) {
      currentWhitelist = settings.whitelist || [];
      currentBlacklist = settings.blacklist || [];
      updateSiteButtons();
    }

    // Load activity feed
    loadActivityFeed(status ? status.stats : null);
  } catch (err) {
    console.error('[CookieGhost Popup] Init error:', err);
  }
}

// Event listeners
enableToggle.addEventListener('change', async () => {
  const enabled = enableToggle.checked;
  await api.runtime.sendMessage({ type: 'setEnabled', enabled });
  updateBodyState(enabled);
});

modeBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const mode = btn.dataset.mode;
    setActiveMode(mode);
    await api.runtime.sendMessage({ type: 'setProtectionMode', mode });
  });
});

whitelistBtn.addEventListener('click', async () => {
  if (!activeDomain) return;

  if (currentWhitelist.includes(activeDomain)) {
    await api.runtime.sendMessage({ type: 'removeFromWhitelist', domain: activeDomain });
    currentWhitelist = currentWhitelist.filter(d => d !== activeDomain);
  } else {
    // Remove from blacklist if present
    if (currentBlacklist.includes(activeDomain)) {
      await api.runtime.sendMessage({ type: 'removeFromBlacklist', domain: activeDomain });
      currentBlacklist = currentBlacklist.filter(d => d !== activeDomain);
    }
    await api.runtime.sendMessage({ type: 'addToWhitelist', domain: activeDomain });
    currentWhitelist.push(activeDomain);
  }
  updateSiteButtons();
});

blacklistBtn.addEventListener('click', async () => {
  if (!activeDomain) return;

  if (currentBlacklist.includes(activeDomain)) {
    await api.runtime.sendMessage({ type: 'removeFromBlacklist', domain: activeDomain });
    currentBlacklist = currentBlacklist.filter(d => d !== activeDomain);
  } else {
    // Remove from whitelist if present
    if (currentWhitelist.includes(activeDomain)) {
      await api.runtime.sendMessage({ type: 'removeFromWhitelist', domain: activeDomain });
      currentWhitelist = currentWhitelist.filter(d => d !== activeDomain);
    }
    await api.runtime.sendMessage({ type: 'addToBlacklist', domain: activeDomain });
    currentBlacklist.push(activeDomain);
  }
  updateSiteButtons();
});

settingsBtn.addEventListener('click', () => {
  api.runtime.openOptionsPage();
});

dashboardBtn.addEventListener('click', () => {
  api.runtime.openOptionsPage();
});

// Helper functions
function updateBodyState(enabled) {
  document.body.classList.toggle('disabled', !enabled);
}

function setActiveMode(mode) {
  modeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function updateSessionStats(stats) {
  if (!stats) return;
  animateNumber(statRandomized, stats.randomized);
  animateNumber(statPreserved, stats.preserved);
}

function animateNumber(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current === target) {
    el.textContent = target;
    return;
  }

  const diff = target - current;
  const steps = Math.min(Math.abs(diff), 20);
  const stepSize = diff / steps;
  let step = 0;

  const interval = setInterval(() => {
    step++;
    if (step >= steps) {
      el.textContent = target;
      clearInterval(interval);
      // Pulse animation
      el.closest('.stat-card')?.classList.add('pulse');
      setTimeout(() => el.closest('.stat-card')?.classList.remove('pulse'), 600);
    } else {
      el.textContent = Math.round(current + stepSize * step);
    }
  }, 30);
}

function updateSiteButtons() {
  const isWhitelisted = currentWhitelist.includes(activeDomain);
  const isBlacklisted = currentBlacklist.includes(activeDomain);

  whitelistBtn.classList.toggle('active', isWhitelisted);
  whitelistBtn.textContent = isWhitelisted ? 'Allowed' : 'Allow Site';

  blacklistBtn.classList.toggle('active', isBlacklisted);
  blacklistBtn.textContent = isBlacklisted ? 'Blocked' : 'Block All';
}

function loadActivityFeed(stats) {
  if (!stats || (!stats.topCookies || stats.topCookies.length === 0)) {
    activityFeed.textContent = '';
    const empty = document.createElement('div');
    empty.className = 'activity-empty';
    empty.textContent = 'No activity yet';
    activityFeed.appendChild(empty);
    return;
  }

  activityFeed.textContent = '';
  const items = stats.topCookies.slice(0, 8);

  for (const [cookieName, count] of items) {
    const item = document.createElement('div');
    item.className = 'activity-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'cookie-name';
    nameSpan.textContent = cookieName;

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'arrow';
    arrowSpan.textContent = '\u2192';

    const valueSpan = document.createElement('span');
    valueSpan.className = 'cookie-value';
    valueSpan.textContent = count + 'x';

    const badge = document.createElement('span');
    badge.className = 'action-badge randomized';
    badge.textContent = 'randomized';

    item.append(nameSpan, arrowSpan, valueSpan, badge);
    activityFeed.appendChild(item);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Refresh stats periodically while popup is open
setInterval(async () => {
  try {
    const status = await api.runtime.sendMessage({ type: 'getStatus' });
    if (status && status.stats) {
      updateSessionStats(status.stats);
      loadActivityFeed(status.stats);
    }

    if (activeDomain) {
      const siteData = await api.runtime.sendMessage({
        type: 'getSiteStats',
        domain: activeDomain,
      });
      if (siteData && siteData.stats) {
        siteRandomized.textContent = siteData.stats.randomized;
        sitePreserved.textContent = siteData.stats.preserved;
      }
    }
  } catch {
    // Background might be restarting
  }
}, 2000);

// Start
init();
