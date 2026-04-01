/**
 * CookieGhost — Statistics tracking
 */

const stats = {
  session: {
    cookiesRandomized: 0,
    cookiesPreserved: 0,
    cookiesBlocked: 0,
    topTrackerCookies: {},
    topTrackerDomains: {},
    perSite: {},
  },
  allTime: {
    totalRandomized: 0,
    totalPreserved: 0,
    dailyHistory: [],
  },
};

let statsDirty = false;
let persistIntervalId = null;

/**
 * Initialize stats — load allTime stats from storage.
 */
async function initStatsTracker() {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  try {
    const stored = await api.storage.local.get(['cookieghostStats']);
    if (stored.cookieghostStats) {
      stats.allTime = stored.cookieghostStats;
      // Ensure dailyHistory array exists
      if (!Array.isArray(stats.allTime.dailyHistory)) {
        stats.allTime.dailyHistory = [];
      }
    }
  } catch (err) {
    console.error('[CookieGhost] Failed to load stats:', err);
  }

  // Persist stats every 30 seconds
  persistIntervalId = setInterval(persistStats, 30000);
}

/**
 * Track a cookie operation.
 * @param {'randomized_incoming'|'randomized_outgoing'|'preserved'|'blocked'} action
 * @param {string} url - The URL associated with the cookie
 * @param {string} cookieName - The name of the cookie
 */
function trackStat(action, url, cookieName) {
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url || 'unknown';
  }

  if (action === 'randomized_incoming' || action === 'randomized_outgoing') {
    stats.session.cookiesRandomized++;
    stats.allTime.totalRandomized++;

    // Track top cookies
    stats.session.topTrackerCookies[cookieName] =
      (stats.session.topTrackerCookies[cookieName] || 0) + 1;

    // Track top domains
    stats.session.topTrackerDomains[domain] =
      (stats.session.topTrackerDomains[domain] || 0) + 1;
  } else if (action === 'preserved') {
    stats.session.cookiesPreserved++;
    stats.allTime.totalPreserved++;
  } else if (action === 'blocked') {
    stats.session.cookiesBlocked++;
  }

  // Per-site stats
  if (!stats.session.perSite[domain]) {
    stats.session.perSite[domain] = { randomized: 0, preserved: 0, blocked: 0 };
  }
  if (action.startsWith('randomized')) {
    stats.session.perSite[domain].randomized++;
  } else if (action === 'preserved') {
    stats.session.perSite[domain].preserved++;
  } else if (action === 'blocked') {
    stats.session.perSite[domain].blocked++;
  }

  // Update daily history
  updateDailyHistory(action);

  statsDirty = true;
}

function updateDailyHistory(action) {
  const today = new Date().toISOString().split('T')[0];
  let todayEntry = stats.allTime.dailyHistory.find(d => d.date === today);

  if (!todayEntry) {
    todayEntry = { date: today, randomized: 0, preserved: 0 };
    stats.allTime.dailyHistory.push(todayEntry);

    // Keep last 90 days
    if (stats.allTime.dailyHistory.length > 90) {
      stats.allTime.dailyHistory = stats.allTime.dailyHistory.slice(-90);
    }
  }

  if (action.startsWith('randomized')) {
    todayEntry.randomized++;
  } else if (action === 'preserved') {
    todayEntry.preserved++;
  }
}

/**
 * Persist allTime stats to storage.
 */
async function persistStats() {
  if (!statsDirty) return;
  statsDirty = false;

  const api = typeof browser !== 'undefined' ? browser : chrome;
  try {
    await api.storage.local.set({ cookieghostStats: stats.allTime });
  } catch (err) {
    console.error('[CookieGhost] Failed to persist stats:', err);
  }
}

/**
 * Get all stats (for popup/options display).
 */
function getStats() {
  return JSON.parse(JSON.stringify(stats));
}

/**
 * Get per-site stats for a specific domain.
 */
function getSiteStats(domain) {
  return stats.session.perSite[domain] || { randomized: 0, preserved: 0, blocked: 0 };
}

/**
 * Get session stats summary.
 */
function getSessionSummary() {
  return {
    randomized: stats.session.cookiesRandomized,
    preserved: stats.session.cookiesPreserved,
    blocked: stats.session.cookiesBlocked,
    topCookies: Object.entries(stats.session.topTrackerCookies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    topDomains: Object.entries(stats.session.topTrackerDomains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
  };
}

/**
 * Reset session stats (keeps allTime).
 */
function resetSessionStats() {
  stats.session = {
    cookiesRandomized: 0,
    cookiesPreserved: 0,
    cookiesBlocked: 0,
    topTrackerCookies: {},
    topTrackerDomains: {},
    perSite: {},
  };
}

/**
 * Reset all stats.
 */
async function resetAllStats() {
  resetSessionStats();
  stats.allTime = {
    totalRandomized: 0,
    totalPreserved: 0,
    dailyHistory: [],
  };
  statsDirty = true;
  await persistStats();
}

if (typeof globalThis !== 'undefined') {
  globalThis.StatsTracker = {
    initStatsTracker,
    trackStat,
    getStats,
    getSiteStats,
    getSessionSummary,
    resetSessionStats,
    resetAllStats,
    persistStats,
  };
}
