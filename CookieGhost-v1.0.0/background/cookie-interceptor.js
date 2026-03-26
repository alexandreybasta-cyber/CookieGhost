/**
 * CookieGhost — Firefox real-time cookie interception via webRequest
 * Also used as the Chrome cookie.onChanged handler.
 */

let interceptorEnabled = true;

/**
 * Initialize Firefox webRequest interceptors.
 * Only active when webRequestBlocking is available (Firefox).
 */
function initFirefoxInterceptor() {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  if (!api.webRequest || !api.webRequest.onHeadersReceived) {
    console.log('[CookieGhost] webRequest API not available, skipping Firefox interceptor');
    return;
  }

  // Check if blocking is supported (Firefox MV2)
  const extraInfoSpec = ['responseHeaders'];
  if (typeof browser !== 'undefined') {
    extraInfoSpec.push('blocking');
  }

  // Intercept incoming Set-Cookie headers
  api.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (!interceptorEnabled) return {};
      if (!details.responseHeaders) return {};

      let modified = false;
      const responseHeaders = details.responseHeaders.map(header => {
        if (header.name.toLowerCase() !== 'set-cookie') return header;

        const parsed = CookieParser.parseSetCookie(header.value);
        if (!parsed) return header;

        const classification = CookieClassifier.classifyCookie(parsed, {
          url: details.url,
          tabId: details.tabId,
          type: details.type,
          initiator: details.initiator || details.originUrl || '',
        });

        if (classification.action === 'randomize') {
          const domain = parsed.domain || CookieParser.extractDomain(details.url);
          parsed.value = SessionManager.getOrCreateRandomValue(domain, parsed.name, parsed.value);
          header.value = CookieParser.serializeSetCookie(parsed);
          StatsTracker.trackStat('randomized_incoming', details.url, parsed.name);
          modified = true;
        } else {
          StatsTracker.trackStat('preserved', details.url, parsed.name);
        }

        return header;
      });

      if (modified) {
        return { responseHeaders };
      }
      return {};
    },
    { urls: ['<all_urls>'] },
    extraInfoSpec
  );

  // Intercept outgoing Cookie headers
  const requestExtraInfo = ['requestHeaders'];
  if (typeof browser !== 'undefined') {
    requestExtraInfo.push('blocking');
  }

  api.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      if (!interceptorEnabled) return {};
      if (!details.requestHeaders) return {};

      let modified = false;
      const requestHeaders = details.requestHeaders.map(header => {
        if (header.name.toLowerCase() !== 'cookie') return header;

        const cookies = CookieParser.parseCookieHeader(header.value);
        const modifiedCookies = cookies.map(cookie => {
          const classification = CookieClassifier.classifyCookie(cookie, {
            url: details.url,
            tabId: details.tabId,
            type: details.type,
          });

          if (classification.action === 'randomize') {
            const domain = CookieParser.extractDomain(details.url);
            cookie.value = SessionManager.getOrCreateRandomValue(domain, cookie.name, cookie.value);
            StatsTracker.trackStat('randomized_outgoing', details.url, cookie.name);
            modified = true;
          }

          return cookie;
        });

        if (modified) {
          header.value = CookieParser.serializeCookieHeader(modifiedCookies);
        }
        return header;
      });

      if (modified) {
        return { requestHeaders };
      }
      return {};
    },
    { urls: ['<all_urls>'] },
    requestExtraInfo
  );

  console.log('[CookieGhost] Firefox webRequest interceptors active');
}

/**
 * Initialize Chrome MV3 cookie.onChanged handler.
 * Post-hoc modification since Chrome MV3 can't block requests.
 */
function initChromeInterceptor() {
  const api = typeof chrome !== 'undefined' ? chrome : null;
  if (!api || !api.cookies || !api.cookies.onChanged) {
    console.log('[CookieGhost] cookies.onChanged not available');
    return;
  }

  // Infinite loop prevention
  const pendingModifications = new Map();
  const MODIFICATION_COOLDOWN = 500;

  function isOurModification(cookie) {
    const key = `${cookie.domain}|${cookie.name}`;
    const lastMod = pendingModifications.get(key);
    if (lastMod && Date.now() - lastMod < MODIFICATION_COOLDOWN) {
      return true;
    }
    return false;
  }

  function markAsOurModification(domain, name) {
    const key = `${domain}|${name}`;
    pendingModifications.set(key, Date.now());
    setTimeout(() => pendingModifications.delete(key), MODIFICATION_COOLDOWN * 2);
  }

  function constructUrl(cookie) {
    const protocol = cookie.secure ? 'https' : 'http';
    const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
    return `${protocol}://${domain}${cookie.path || '/'}`;
  }

  api.cookies.onChanged.addListener((changeInfo) => {
    if (!interceptorEnabled) return;
    if (changeInfo.removed) return;

    const cookie = changeInfo.cookie;

    // Prevent infinite loop
    if (isOurModification(cookie)) return;

    const classification = CookieClassifier.classifyCookie({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite ? cookie.sameSite.toLowerCase() : 'none',
    }, { source: 'onChanged' });

    if (classification.action === 'randomize') {
      const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      const randomValue = SessionManager.getOrCreateRandomValue(domain, cookie.name, cookie.value);

      // Don't re-set if value already matches
      if (randomValue === cookie.value) return;

      markAsOurModification(cookie.domain, cookie.name);

      const cookieDetails = {
        url: constructUrl(cookie),
        name: cookie.name,
        value: randomValue,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite || 'no_restriction',
      };

      if (cookie.expirationDate) {
        cookieDetails.expirationDate = cookie.expirationDate;
      }

      api.cookies.set(cookieDetails).then(() => {
        StatsTracker.trackStat('randomized_incoming', constructUrl(cookie), cookie.name);
      }).catch(err => {
        console.warn('[CookieGhost] Failed to set cookie:', cookie.name, err);
      });
    } else {
      StatsTracker.trackStat('preserved', `https://${cookie.domain}`, cookie.name);
    }
  });

  console.log('[CookieGhost] Chrome cookies.onChanged interceptor active');
}

/**
 * Initialize DNR rules for Chrome (Layer 3 — tracker domain blocking).
 */
async function initDNRRules() {
  const api = typeof chrome !== 'undefined' ? chrome : null;
  if (!api || !api.declarativeNetRequest) {
    console.log('[CookieGhost] declarativeNetRequest not available');
    return;
  }

  try {
    const response = await fetch(api.runtime.getURL('data/tracker-domains.json'));
    const domains = await response.json();

    // Get existing rules to remove
    const existingRules = await api.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map(r => r.id);

    // Create new rules (max 5000 dynamic rules in Chrome)
    const addRules = domains.slice(0, 2000).map((domain, index) => ({
      id: index + 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'cookie', operation: 'remove' }],
        responseHeaders: [{ header: 'set-cookie', operation: 'remove' }],
      },
      condition: {
        urlFilter: `||${domain}`,
        resourceTypes: ['sub_frame', 'script', 'image', 'xmlhttprequest', 'other'],
      },
    }));

    await api.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules,
    });

    console.log('[CookieGhost] DNR rules active for', addRules.length, 'tracker domains');
  } catch (err) {
    console.error('[CookieGhost] Failed to set DNR rules:', err);
  }
}

/**
 * Enable/disable interception.
 */
function setInterceptorEnabled(enabled) {
  interceptorEnabled = enabled;
}

function isInterceptorEnabled() {
  return interceptorEnabled;
}

if (typeof globalThis !== 'undefined') {
  globalThis.CookieInterceptor = {
    initFirefoxInterceptor,
    initChromeInterceptor,
    initDNRRules,
    setInterceptorEnabled,
    isInterceptorEnabled,
  };
}
