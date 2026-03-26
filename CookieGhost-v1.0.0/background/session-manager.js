/**
 * CookieGhost — Per-site, per-session seed management
 * Ensures consistent randomized values within a browsing session.
 */

// In-memory store: Map<domain, Map<cookieName, randomizedValue>>
let sessionSeeds = new Map();

// Track when session started
let sessionStartTime = Date.now();

// How often to reset seeds (0 = never within session)
let resetIntervalMs = 0;

/**
 * Initialize session manager. Restores seeds from session storage if available (Chrome MV3).
 */
async function initSessionManager() {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  try {
    // Load reset interval setting
    const settings = await api.storage.local.get(['seedResetInterval']);
    const interval = settings.seedResetInterval || 'session';

    switch (interval) {
      case 'hour':
        resetIntervalMs = 3600000;
        break;
      case 'never':
        resetIntervalMs = 0;
        break;
      case 'session':
      default:
        resetIntervalMs = 0; // Seeds are in-memory, so they reset naturally on restart
        break;
    }

    // For Chrome MV3: restore seeds from session storage to survive service worker restarts
    if (api.storage.session) {
      try {
        const stored = await api.storage.session.get(['sessionSeeds', 'sessionStartTime']);
        if (stored.sessionSeeds) {
          // Reconstruct Map from stored object
          const parsed = stored.sessionSeeds;
          for (const [domain, cookies] of Object.entries(parsed)) {
            const cookieMap = new Map(Object.entries(cookies));
            sessionSeeds.set(domain, cookieMap);
          }
          sessionStartTime = stored.sessionStartTime || Date.now();
          console.log('[CookieGhost] Restored session seeds:', sessionSeeds.size, 'domains');
        }
      } catch (e) {
        console.log('[CookieGhost] No stored session seeds to restore');
      }
    }

    // Set up periodic reset if configured
    if (resetIntervalMs > 0 && api.alarms) {
      api.alarms.create('cookieghost-seed-reset', {
        periodInMinutes: resetIntervalMs / 60000,
      });
      api.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'cookieghost-seed-reset') {
          clearAllSeeds();
          console.log('[CookieGhost] Seeds reset by alarm');
        }
      });
    }
  } catch (err) {
    console.error('[CookieGhost] Session manager init error:', err);
  }
}

/**
 * Get or create a randomized value for a specific cookie on a domain.
 * Returns consistent value within the same session.
 */
function getOrCreateRandomValue(domain, cookieName, originalValue) {
  const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;

  let domainSeeds = sessionSeeds.get(cleanDomain);
  if (!domainSeeds) {
    domainSeeds = new Map();
    sessionSeeds.set(cleanDomain, domainSeeds);
  }

  if (domainSeeds.has(cookieName)) {
    return domainSeeds.get(cookieName);
  }

  const newValue = CookieRandomizer.generateRandomValue(cookieName, originalValue);
  domainSeeds.set(cookieName, newValue);

  // Persist to session storage for Chrome MV3 service worker resilience
  persistSeeds();

  return newValue;
}

/**
 * Clear seeds for a specific domain.
 */
function clearDomainSeeds(domain) {
  const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
  sessionSeeds.delete(cleanDomain);
  persistSeeds();
}

/**
 * Clear all session seeds.
 */
function clearAllSeeds() {
  sessionSeeds.clear();
  sessionStartTime = Date.now();
  persistSeeds();
}

/**
 * Get all seeds (for debug/stats display).
 */
function getAllSeeds() {
  const result = {};
  for (const [domain, cookies] of sessionSeeds) {
    result[domain] = Object.fromEntries(cookies);
  }
  return result;
}

/**
 * Get the count of randomized cookies per domain.
 */
function getSeedCounts() {
  const counts = {};
  for (const [domain, cookies] of sessionSeeds) {
    counts[domain] = cookies.size;
  }
  return counts;
}

// Debounced persistence to session storage
let persistTimeout = null;

function persistSeeds() {
  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    if (api.storage.session) {
      const serialized = {};
      for (const [domain, cookies] of sessionSeeds) {
        serialized[domain] = Object.fromEntries(cookies);
      }
      api.storage.session.set({
        sessionSeeds: serialized,
        sessionStartTime,
      }).catch(() => {});
    }
  }, 1000);
}

if (typeof globalThis !== 'undefined') {
  globalThis.SessionManager = {
    initSessionManager,
    getOrCreateRandomValue,
    clearDomainSeeds,
    clearAllSeeds,
    getAllSeeds,
    getSeedCounts,
  };
}
