/**
 * CookieGhost — Cookie classification engine
 * Determines whether a cookie should be randomized or preserved.
 */

// Tracking cookie patterns loaded from data
let trackingPatterns = [];
let functionalPatterns = [];
let trackerDomains = [];
let userWhitelist = [];
let userBlacklist = [];
let protectionMode = 'balanced'; // 'aggressive' | 'balanced' | 'gentle'

// Value patterns that indicate tracking IDs
const TRACKING_VALUE_PATTERNS = [
  /^GA\d\.\d\.\d+\.\d+$/,                                              // Google Analytics
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID
  /^[0-9a-f]{32,}$/i,                                                   // Long hex strings (32+)
  /^[A-Za-z0-9+/]{20,}={0,2}$/,                                        // Base64 encoded IDs
  /^\d{10,13}$/,                                                         // Unix timestamps
  /^fb\.\d\.\d+\.\d+$/,                                                 // Facebook pixel
  /^[0-9a-f]{16,}$/i,                                                   // Medium hex strings
  /^GS\d\.\d\..+$/,                                                     // GA4 format
  /^GCL\.\d+\..+$/,                                                     // Google Click format
];

// Auth-related name patterns
const AUTH_NAME_PATTERNS = [
  /^PHPSESSID$/i,
  /^JSESSIONID$/i,
  /^ASP\.NET_SessionId$/i,
  /^connect\.sid$/i,
  /^csrf_?token$/i,
  /^_?csrf$/i,
  /^XSRF-TOKEN$/i,
  /^__Host-.+$/,
  /^__Secure-.+$/,
  /^auth_?token$/i,
  /^access_?token$/i,
  /^refresh_?token$/i,
  /^remember_?me$/i,
  /^wp-settings-.+$/,
  /^wordpress_logged_in_.+$/,
  /^laravel_session$/,
  /^rack\.session$/,
  /^_session_id$/,
  /^express\.sid$/,
  /^__cf_bm$/,
  /^cf_clearance$/,
  /^__cfduid$/,
  /^AWSALB(CORS)?$/,
  /^csrftoken$/,
  /^_sso/i,
  /^_auth/i,
  /^sid$/i,
  /session/i,
];

/**
 * Initialize classifier with data files.
 * Call this on startup.
 */
async function initClassifier() {
  try {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    // Load data files via fetch (works in both Firefox background and Chrome service worker)
    const [trackingResp, functionalResp, domainsResp] = await Promise.all([
      fetch(api.runtime.getURL('data/tracking-cookies.json')),
      fetch(api.runtime.getURL('data/functional-cookies.json')),
      fetch(api.runtime.getURL('data/tracker-domains.json')),
    ]);

    trackingPatterns = await trackingResp.json();
    functionalPatterns = await functionalResp.json();
    trackerDomains = await domainsResp.json();

    // Load user settings
    const settings = await api.storage.local.get([
      'whitelist', 'blacklist', 'protectionMode'
    ]);
    userWhitelist = settings.whitelist || [];
    userBlacklist = settings.blacklist || [];
    protectionMode = settings.protectionMode || 'balanced';

    console.log('[CookieGhost] Classifier initialized:', {
      tracking: trackingPatterns.length,
      functional: functionalPatterns.length,
      domains: trackerDomains.length,
    });
  } catch (err) {
    console.error('[CookieGhost] Failed to initialize classifier:', err);
  }
}

/**
 * Listen for settings changes.
 */
function setupClassifierListeners() {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.whitelist) userWhitelist = changes.whitelist.newValue || [];
    if (changes.blacklist) userBlacklist = changes.blacklist.newValue || [];
    if (changes.protectionMode) protectionMode = changes.protectionMode.newValue || 'balanced';
  });
}

/**
 * Classify a cookie to determine whether it should be randomized.
 *
 * @param {Object} cookie - { name, value, domain?, path?, secure?, httpOnly?, sameSite?, maxAge?, expires? }
 * @param {Object} context - { url?, tabId?, type?, initiator?, source? }
 * @returns {{ action: 'randomize'|'preserve'|'uncertain', reason: string, confidence: number }}
 */
function classifyCookie(cookie, context = {}) {
  const name = cookie.name || '';
  const value = cookie.value || '';
  const domain = cookie.domain || '';

  // === PRIORITY 1: User blacklist — always randomize ===
  if (isDomainInList(domain, userBlacklist) || isDomainInList(extractDomainFromContext(context), userBlacklist)) {
    return { action: 'randomize', reason: 'Domain on user blacklist', confidence: 1.0 };
  }

  // === PRIORITY 2: User whitelist — never randomize ===
  if (isDomainInList(domain, userWhitelist) || isDomainInList(extractDomainFromContext(context), userWhitelist)) {
    return { action: 'preserve', reason: 'Domain on user whitelist', confidence: 1.0 };
  }

  // === PRIORITY 3: Known functional cookies — never randomize ===
  if (matchesAnyPattern(name, functionalPatterns)) {
    return { action: 'preserve', reason: 'Known functional cookie', confidence: 0.95 };
  }

  // Auth name pattern match
  if (AUTH_NAME_PATTERNS.some(p => p.test(name))) {
    return { action: 'preserve', reason: 'Auth/session cookie pattern', confidence: 0.9 };
  }

  // Strong auth signals: HttpOnly + Secure + restrictive SameSite
  if (cookie.httpOnly && cookie.secure &&
      (cookie.sameSite === 'strict' || cookie.sameSite === 'lax')) {
    return { action: 'preserve', reason: 'Strong auth cookie signals (HttpOnly+Secure+SameSite)', confidence: 0.85 };
  }

  // === PRIORITY 4: Known tracking cookies — always randomize ===
  if (matchesAnyPattern(name, trackingPatterns)) {
    return { action: 'randomize', reason: 'Known tracking cookie', confidence: 0.95 };
  }

  // Known tracker domain
  if (isTrackerDomain(domain)) {
    return { action: 'randomize', reason: 'Known tracker domain', confidence: 0.9 };
  }

  // Request URL is to a tracker domain
  if (context.url && isTrackerDomain(extractDomainFromUrl(context.url))) {
    return { action: 'randomize', reason: 'Request to tracker domain', confidence: 0.85 };
  }

  // Third-party + long expiration = likely tracking
  if (context.url && domain) {
    const isThirdParty = CookieParser.isThirdParty(domain, context.url);
    const isLongLived = cookie.maxAge ? cookie.maxAge > 7 * 86400 : false;

    if (isThirdParty && isLongLived) {
      return { action: 'randomize', reason: 'Third-party long-lived cookie', confidence: 0.8 };
    }
  }

  // Value looks like a tracking ID
  if (value && TRACKING_VALUE_PATTERNS.some(p => p.test(value))) {
    return { action: 'randomize', reason: 'Value matches tracking ID pattern', confidence: 0.7 };
  }

  // First-party + short-lived + session-scoped = likely functional
  if (context.url && domain) {
    const isFirstParty = !CookieParser.isThirdParty(domain, context.url);
    const isShort = CookieParser.isShortLived(cookie, 30);
    const isSession = CookieParser.isSessionCookie(cookie);

    if (isFirstParty && (isShort || isSession)) {
      return { action: 'preserve', reason: 'First-party short-lived/session cookie', confidence: 0.7 };
    }
  }

  // === UNCERTAIN — apply protection mode ===
  switch (protectionMode) {
    case 'aggressive':
      return { action: 'randomize', reason: 'Uncertain (aggressive mode)', confidence: 0.5 };
    case 'gentle':
      return { action: 'preserve', reason: 'Uncertain (gentle mode)', confidence: 0.5 };
    case 'balanced':
    default:
      return { action: 'randomize', reason: 'Uncertain (balanced mode)', confidence: 0.5 };
  }
}

// === Helper functions ===

function matchesAnyPattern(name, patterns) {
  return patterns.some(p => {
    try {
      return new RegExp(p.pattern).test(name);
    } catch {
      return false;
    }
  });
}

function isTrackerDomain(domain) {
  if (!domain) return false;
  const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
  return trackerDomains.some(td =>
    cleanDomain === td || cleanDomain.endsWith('.' + td)
  );
}

function isDomainInList(domain, list) {
  if (!domain || !list || list.length === 0) return false;
  const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
  return list.some(d =>
    cleanDomain === d || cleanDomain.endsWith('.' + d)
  );
}

function extractDomainFromContext(context) {
  if (context.url) return extractDomainFromUrl(context.url);
  return '';
}

function extractDomainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// === Expose globally ===
if (typeof globalThis !== 'undefined') {
  globalThis.CookieClassifier = {
    classifyCookie,
    initClassifier,
    setupClassifierListeners,
    getProtectionMode: () => protectionMode,
    setProtectionMode: (mode) => { protectionMode = mode; },
  };
}
