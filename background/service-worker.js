/**
 * CookieGhost — Main background / service worker entry point
 * Initializes all modules and handles messaging.
 */

// Import dependencies via importScripts (Chrome MV3 non-module service worker)
// IMPORTANT: libs must load FIRST since background scripts depend on them
try {
  importScripts(
    '../lib/browser-compat.js',
    '../lib/cookie-parser.js',
    '../lib/random-generator.js'
  );
  console.log('[CookieGhost] Lib scripts loaded');
} catch (e) {
  console.error('[CookieGhost] Failed to import lib scripts:', e);
}

try {
  importScripts(
    'cookie-classifier.js',
    'cookie-randomizer.js',
    'session-manager.js',
    'stats-tracker.js',
    'cookie-interceptor.js'
  );
  console.log('[CookieGhost] Background scripts loaded');
} catch (e) {
  console.error('[CookieGhost] Failed to import background scripts:', e);
}

// Extension enabled state
let extensionEnabled = true;
let initComplete = false;

/**
 * Main initialization — each step is wrapped in try/catch so one failure
 * doesn't kill the whole extension.
 */
async function init() {
  console.log('[CookieGhost] Initializing...');

  // Load enabled state
  try {
    const stored = await _swApi.storage.local.get(['extensionEnabled']);
    extensionEnabled = stored.extensionEnabled !== false;
  } catch (e) {
    console.warn('[CookieGhost] Could not load enabled state:', e);
    extensionEnabled = true;
  }

  // Initialize classifier (loads JSON data files)
  try {
    if (typeof CookieClassifier !== 'undefined') {
      await CookieClassifier.initClassifier();
      CookieClassifier.setupClassifierListeners();
      console.log('[CookieGhost] Classifier ready');
    } else {
      console.error('[CookieGhost] CookieClassifier not loaded');
    }
  } catch (e) {
    console.error('[CookieGhost] Classifier init failed:', e);
  }

  // Initialize session manager
  try {
    if (typeof SessionManager !== 'undefined') {
      await SessionManager.initSessionManager();
      console.log('[CookieGhost] Session manager ready');
    }
  } catch (e) {
    console.error('[CookieGhost] Session manager init failed:', e);
  }

  // Initialize stats tracker
  try {
    if (typeof StatsTracker !== 'undefined') {
      await StatsTracker.initStatsTracker();
      console.log('[CookieGhost] Stats tracker ready');
    }
  } catch (e) {
    console.error('[CookieGhost] Stats tracker init failed:', e);
  }

  // Start interceptors based on browser
  try {
    if (typeof CookieInterceptor !== 'undefined') {
      const isFirefox = typeof browser !== 'undefined' && typeof chrome === 'undefined';
      if (isFirefox) {
        CookieInterceptor.initFirefoxInterceptor();
      } else {
        CookieInterceptor.initChromeInterceptor();
        // DNR rules are optional — don't let them crash everything
        try {
          await CookieInterceptor.initDNRRules();
        } catch (dnrErr) {
          console.warn('[CookieGhost] DNR rules failed (non-fatal):', dnrErr);
        }
      }
      CookieInterceptor.setInterceptorEnabled(extensionEnabled);
      console.log('[CookieGhost] Interceptors ready');
    }
  } catch (e) {
    console.error('[CookieGhost] Interceptor init failed:', e);
  }

  initComplete = true;
  console.log('[CookieGhost] Initialized successfully', {
    enabled: extensionEnabled,
  });
}

/**
 * Handle messages from popup, options, and content scripts.
 */
const _swApi = typeof browser !== 'undefined' ? browser : chrome;
_swApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => {
    console.error('[CookieGhost] Message handler error:', err);
    sendResponse({ error: err.message });
  });
  return true; // Keep message channel open for async response
});

async function handleMessage(message, sender) {
  // Safe getters that won't crash if modules aren't loaded
  const getMode = () => {
    try { return CookieClassifier.getProtectionMode(); } catch { return 'balanced'; }
  };
  const getSessionStats = () => {
    try { return StatsTracker.getSessionSummary(); } catch { return { randomized: 0, preserved: 0, blocked: 0, topCookies: [], topDomains: [] }; }
  };

  switch (message.type) {
    case 'getStatus':
      return {
        enabled: extensionEnabled,
        mode: getMode(),
        stats: getSessionStats(),
      };

    case 'setEnabled': {
      extensionEnabled = message.enabled;
      try { CookieInterceptor.setInterceptorEnabled(extensionEnabled); } catch {}
      await _swApi.storage.local.set({ extensionEnabled });
      return { enabled: extensionEnabled };
    }

    case 'setProtectionMode': {
      try { CookieClassifier.setProtectionMode(message.mode); } catch {}
      await _swApi.storage.local.set({ protectionMode: message.mode });
      return { mode: message.mode };
    }

    case 'getSiteStats': {
      const domain = message.domain;
      try {
        return {
          stats: StatsTracker.getSiteStats(domain),
          seeds: SessionManager.getSeedCounts(),
        };
      } catch {
        return { stats: { randomized: 0, preserved: 0, blocked: 0 }, seeds: {} };
      }
    }

    case 'getFullStats':
      try { return StatsTracker.getStats(); } catch { return { session: {}, allTime: {} }; }

    case 'resetSessionStats':
      try { StatsTracker.resetSessionStats(); } catch {}
      return { success: true };

    case 'resetAllStats':
      try { await StatsTracker.resetAllStats(); } catch {}
      return { success: true };

    case 'clearSeeds':
      try {
        if (message.domain) {
          SessionManager.clearDomainSeeds(message.domain);
        } else {
          SessionManager.clearAllSeeds();
        }
      } catch {}
      return { success: true };

    case 'addToWhitelist': {
      const wlData = await _swApi.storage.local.get(['whitelist']);
      const whitelist = wlData.whitelist || [];
      if (!whitelist.includes(message.domain)) {
        whitelist.push(message.domain);
        await _swApi.storage.local.set({ whitelist });
      }
      return { success: true, whitelist };
    }

    case 'removeFromWhitelist': {
      const wlData2 = await _swApi.storage.local.get(['whitelist']);
      const wl = (wlData2.whitelist || []).filter(d => d !== message.domain);
      await _swApi.storage.local.set({ whitelist: wl });
      return { success: true, whitelist: wl };
    }

    case 'addToBlacklist': {
      const blData = await _swApi.storage.local.get(['blacklist']);
      const blacklist = blData.blacklist || [];
      if (!blacklist.includes(message.domain)) {
        blacklist.push(message.domain);
        await _swApi.storage.local.set({ blacklist });
      }
      return { success: true, blacklist };
    }

    case 'removeFromBlacklist': {
      const blData2 = await _swApi.storage.local.get(['blacklist']);
      const bl = (blData2.blacklist || []).filter(d => d !== message.domain);
      await _swApi.storage.local.set({ blacklist: bl });
      return { success: true, blacklist: bl };
    }

    case 'getSettings': {
      const settings = await _swApi.storage.local.get([
        'protectionMode', 'whitelist', 'blacklist', 'seedResetInterval',
        'enableDocCookieOverride', 'enableDNR', 'debugMode',
      ]);
      return {
        protectionMode: settings.protectionMode || 'balanced',
        whitelist: settings.whitelist || [],
        blacklist: settings.blacklist || [],
        seedResetInterval: settings.seedResetInterval || 'session',
        enableDocCookieOverride: settings.enableDocCookieOverride !== false,
        enableDNR: settings.enableDNR !== false,
        debugMode: settings.debugMode || false,
      };
    }

    case 'saveSettings': {
      await _swApi.storage.local.set(message.settings);
      return { success: true };
    }

    case 'classifyCookie':
      try {
        return CookieClassifier.classifyCookie(message.cookie, message.context || {});
      } catch {
        return { action: 'preserve', reason: 'Classifier not ready', confidence: 0 };
      }

    case 'getActivityFeed': {
      return { activity: getSessionStats() };
    }

    default:
      return { error: 'Unknown message type: ' + message.type };
  }
}

// Persist stats on service worker suspend (Chrome MV3)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => {
    try { StatsTracker.persistStats(); } catch {}
  });
}

// Start
init();
