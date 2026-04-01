/**
 * CookieGhost — Options page logic
 */

const api = typeof browser !== 'undefined' ? browser : chrome;

// Tab navigation
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    navBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
  });
});

// Settings state
let settings = {};

// Initialize
async function init() {
  settings = await api.runtime.sendMessage({ type: 'getSettings' });

  // Protection mode
  const modeRadio = document.querySelector(`input[name="protectionMode"][value="${settings.protectionMode}"]`);
  if (modeRadio) modeRadio.checked = true;

  // Reset interval
  document.getElementById('resetInterval').value = settings.seedResetInterval || 'session';

  // Advanced
  document.getElementById('enableDocOverride').checked = settings.enableDocCookieOverride !== false;
  document.getElementById('enableDNR').checked = settings.enableDNR !== false;
  document.getElementById('debugMode').checked = settings.debugMode || false;

  // Load lists
  loadWhitelist(settings.whitelist || []);
  loadBlacklist(settings.blacklist || []);
  await loadCookiePatterns();
  await loadStats();
}

// Save helper
function showSaved() {
  const el = document.getElementById('saveIndicator');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1500);
}

async function saveSetting(key, value) {
  await api.runtime.sendMessage({
    type: 'saveSettings',
    settings: { [key]: value },
  });
  showSaved();
}

// Protection mode
document.querySelectorAll('input[name="protectionMode"]').forEach(radio => {
  radio.addEventListener('change', async (e) => {
    await api.runtime.sendMessage({ type: 'setProtectionMode', mode: e.target.value });
    showSaved();
  });
});

// Reset interval
document.getElementById('resetInterval').addEventListener('change', async (e) => {
  await saveSetting('seedResetInterval', e.target.value);
});

// Clear seeds
document.getElementById('clearSeedsBtn').addEventListener('click', async () => {
  await api.runtime.sendMessage({ type: 'clearSeeds' });
  showSaved();
});

// Advanced toggles
document.getElementById('enableDocOverride').addEventListener('change', async (e) => {
  await saveSetting('enableDocCookieOverride', e.target.checked);
});

document.getElementById('enableDNR').addEventListener('change', async (e) => {
  await saveSetting('enableDNR', e.target.checked);
});

document.getElementById('debugMode').addEventListener('change', async (e) => {
  await saveSetting('debugMode', e.target.checked);
});

// Whitelist management
function buildDomainList(container, list, listName) {
  container.textContent = '';
  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = listName === 'whitelist' ? 'No whitelisted sites' : 'No blacklisted sites';
    container.appendChild(empty);
    return;
  }
  for (const domain of list) {
    const row = document.createElement('div');
    row.className = 'domain-item';
    const span = document.createElement('span');
    span.textContent = domain;
    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.textContent = '\u00d7';
    btn.addEventListener('click', () => removeDomain(domain, listName));
    row.append(span, btn);
    container.appendChild(row);
  }
}

function loadWhitelist(list) {
  buildDomainList(document.getElementById('whitelistContainer'), list, 'whitelist');
}

function loadBlacklist(list) {
  buildDomainList(document.getElementById('blacklistContainer'), list, 'blacklist');
}

document.getElementById('addWhitelistBtn').addEventListener('click', async () => {
  const input = document.getElementById('whitelistInput');
  const domain = input.value.trim().toLowerCase();
  if (!domain) return;

  const result = await api.runtime.sendMessage({ type: 'addToWhitelist', domain });
  loadWhitelist(result.whitelist);
  input.value = '';
  showSaved();
});

document.getElementById('addBlacklistBtn').addEventListener('click', async () => {
  const input = document.getElementById('blacklistInput');
  const domain = input.value.trim().toLowerCase();
  if (!domain) return;

  const result = await api.runtime.sendMessage({ type: 'addToBlacklist', domain });
  loadBlacklist(result.blacklist);
  input.value = '';
  showSaved();
});

async function removeDomain(domain, list) {
  const type = list === 'whitelist' ? 'removeFromWhitelist' : 'removeFromBlacklist';
  const result = await api.runtime.sendMessage({ type, domain });

  if (list === 'whitelist') {
    loadWhitelist(result.whitelist);
  } else {
    loadBlacklist(result.blacklist);
  }
  showSaved();
}

// Cookie patterns
async function loadCookiePatterns() {
  try {
    const [trackingResp, functionalResp] = await Promise.all([
      fetch(api.runtime.getURL('data/tracking-cookies.json')),
      fetch(api.runtime.getURL('data/functional-cookies.json')),
    ]);
    const tracking = await trackingResp.json();
    const functional = await functionalResp.json();

    const trackingList = document.getElementById('trackingList');
    trackingList.textContent = '';
    for (const c of tracking) {
      const row = document.createElement('div');
      row.className = 'cookie-list-item';
      const nameEl = document.createElement('span');
      nameEl.className = 'cookie-name';
      nameEl.textContent = c.name;
      const compEl = document.createElement('span');
      compEl.className = 'cookie-company';
      compEl.textContent = c.company || '';
      const catEl = document.createElement('span');
      catEl.className = 'cookie-category ' + (c.category || '');
      catEl.textContent = c.category || '';
      row.append(nameEl, compEl, catEl);
      trackingList.appendChild(row);
    }

    const functionalList = document.getElementById('functionalList');
    functionalList.textContent = '';
    for (const c of functional) {
      const row = document.createElement('div');
      row.className = 'cookie-list-item';
      const nameEl = document.createElement('span');
      nameEl.className = 'cookie-name';
      nameEl.textContent = c.name;
      const compEl = document.createElement('span');
      compEl.className = 'cookie-company';
      compEl.textContent = c.company || '';
      const catEl = document.createElement('span');
      catEl.className = 'cookie-category ' + (c.category || '');
      catEl.textContent = c.category || '';
      row.append(nameEl, compEl, catEl);
      functionalList.appendChild(row);
    }
  } catch (err) {
    console.error('Failed to load cookie patterns:', err);
  }
}

// Statistics
async function loadStats() {
  try {
    const data = await api.runtime.sendMessage({ type: 'getFullStats' });
    if (!data) return;

    // All time
    document.getElementById('allTimeRandomized').textContent =
      (data.allTime?.totalRandomized || 0).toLocaleString();
    document.getElementById('allTimePreserved').textContent =
      (data.allTime?.totalPreserved || 0).toLocaleString();

    // Top cookies chart
    renderBarChart('topCookiesChart', data.session?.topTrackerCookies || {});

    // Top domains chart
    renderBarChart('topDomainsChart', data.session?.topTrackerDomains || {});

    // Daily chart
    renderDailyChart(data.allTime?.dailyHistory || []);
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function renderBarChart(containerId, dataObj) {
  const container = document.getElementById(containerId);
  const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]).slice(0, 10);
  container.textContent = '';

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No data yet';
    container.appendChild(empty);
    return;
  }

  const maxVal = entries[0][1];
  for (const [label, count] of entries) {
    const row = document.createElement('div');
    row.className = 'bar-item';
    const labelEl = document.createElement('span');
    labelEl.className = 'bar-label';
    labelEl.title = label;
    labelEl.textContent = label;
    const track = document.createElement('div');
    track.className = 'bar-track';
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = (count / maxVal) * 100 + '%';
    track.appendChild(fill);
    const countEl = document.createElement('span');
    countEl.className = 'bar-count';
    countEl.textContent = count;
    row.append(labelEl, track, countEl);
    container.appendChild(row);
  }
}

function renderDailyChart(history) {
  const container = document.getElementById('dailyChart');
  const last30 = history.slice(-30);
  container.textContent = '';

  if (last30.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No data yet';
    container.appendChild(empty);
    return;
  }

  const maxVal = Math.max(...last30.map(d => d.randomized), 1);
  for (const day of last30) {
    const height = Math.max((day.randomized / maxVal) * 90, 2);
    const bar = document.createElement('div');
    bar.className = 'daily-bar';
    bar.style.height = height + 'px';
    bar.title = day.date + ': ' + day.randomized + ' randomized';
    container.appendChild(bar);
  }
}

// Import/Export
document.getElementById('exportRulesBtn').addEventListener('click', async () => {
  const currentSettings = await api.runtime.sendMessage({ type: 'getSettings' });
  const exportData = {
    version: '1.0.0',
    whitelist: currentSettings.whitelist,
    blacklist: currentSettings.blacklist,
    protectionMode: currentSettings.protectionMode,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cookieghost-rules.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importRulesBtn').addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.whitelist) await saveSetting('whitelist', data.whitelist);
    if (data.blacklist) await saveSetting('blacklist', data.blacklist);
    if (data.protectionMode) {
      await api.runtime.sendMessage({ type: 'setProtectionMode', mode: data.protectionMode });
    }

    // Reload
    const updated = await api.runtime.sendMessage({ type: 'getSettings' });
    loadWhitelist(updated.whitelist || []);
    loadBlacklist(updated.blacklist || []);
    showSaved();
  } catch (err) {
    alert('Failed to import rules: ' + err.message);
  }
});

// Reset stats
document.getElementById('resetSessionBtn').addEventListener('click', async () => {
  await api.runtime.sendMessage({ type: 'resetSessionStats' });
  await loadStats();
  showSaved();
});

document.getElementById('resetAllBtn').addEventListener('click', async () => {
  if (confirm('Reset all statistics? This cannot be undone.')) {
    await api.runtime.sendMessage({ type: 'resetAllStats' });
    await loadStats();
    showSaved();
  }
});

// Export logs
document.getElementById('exportLogsBtn').addEventListener('click', () => {
  const logData = {
    timestamp: new Date().toISOString(),
    settings,
    note: 'Enable debug mode and check the browser console for detailed logs.',
  };

  const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cookieghost-debug.json';
  a.click();
  URL.revokeObjectURL(url);
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Start
init();
