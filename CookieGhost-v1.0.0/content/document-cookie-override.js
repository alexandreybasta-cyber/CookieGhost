/**
 * CookieGhost — document.cookie override (injected into MAIN world)
 * Intercepts JavaScript cookie access to randomize tracking cookies client-side.
 * This script runs in the page context, not the extension's isolated world.
 */
(function() {
  'use strict';

  // Config injected by the content script via data attribute
  const configEl = document.getElementById('cookieghost-config');
  let config = {
    enabled: true,
    trackingPatterns: [],
    functionalPatterns: [],
  };

  if (configEl) {
    try {
      config = JSON.parse(configEl.textContent);
    } catch (e) {
      // Use defaults
    }
  }

  if (!config.enabled) return;

  // Known tracking cookie name patterns (compiled regexes)
  const TRACKING_REGEXES = [
    /^_ga$/, /^_ga_.+$/, /^_gid$/, /^_gat/, /^_gac_.+$/,
    /^__utm[a-z]$/, /^__utmv$/,
    /^_fbp$/, /^_fbc$/, /^fr$/, /^datr$/, /^sb$/,
    /^_gcl_(au|aw|dc)$/, /^IDE$/, /^DSID$/, /^ANID$/, /^NID$/, /^1P_JAR$/,
    /^_hjid$/, /^_hjSession_.+$/, /^_hjSessionUser_.+$/,
    /^_tt_enable_cookie$/, /^_ttp$/,
    /^_uetsid$/, /^_uetvid$/,
    /^_pin_unauth$/, /^_pinterest_sess$/,
    /^_li_fat_id$/, /^li_sugr$/, /^bcookie$/,
    /^_clck$/, /^_clsk$/,
    /^mp_.+_mixpanel$/, /^ajs_anonymous_id$/, /^ajs_user_id$/,
    /^hubspotutk$/, /^__hstc$/, /^__hssc$/, /^__hssrc$/,
    /^_mkto_trk$/, /^_biz_uid$/, /^_biz_nA$/,
    /^_rdt_uuid$/, /^rdt_.+$/,
    /^_scid$/, /^_scid_r$/, /^sc_anonymous_id$/,
    /^_derived_epik$/, /^__gads$/, /^__gpi$/, /^test_cookie$/,
    /^_opt_(awcid|awmid|awgid|awkid|utmc)$/,
    /^_omappvp$/, /^_omappvs$/, /^ki_[rt]$/,
  ];

  // Known functional patterns to NEVER touch
  const FUNCTIONAL_REGEXES = [
    /^PHPSESSID$/i, /^JSESSIONID$/i, /^ASP\.NET_SessionId$/i,
    /^connect\.sid$/, /^csrf/i, /^_csrf$/i, /^XSRF-TOKEN$/i,
    /^__Host-.+$/, /^__Secure-.+$/,
    /^auth/i, /^access_token$/i, /^refresh_token$/i, /^remember_me$/i,
    /^wp-settings-.+$/, /^wordpress_logged_in_.+$/,
    /^laravel_session$/, /^rack\.session$/, /^_session_id$/, /^express\.sid$/,
    /^__cf_bm$/, /^cf_clearance$/, /^AWSALB/,
    /session/i,
  ];

  function isTrackingCookie(name) {
    if (FUNCTIONAL_REGEXES.some(r => r.test(name))) return false;
    return TRACKING_REGEXES.some(r => r.test(name));
  }

  // Simple seeded random per cookie name (deterministic within page load)
  const seedMap = new Map();

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function seededRandHex(name, length) {
    if (seedMap.has(name)) return seedMap.get(name);
    const chars = '0123456789abcdef';
    let result = '';
    let seed = simpleHash(name + document.domain + Date.now().toString().slice(0, -4));
    for (let i = 0; i < length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      result += chars[seed % 16];
    }
    seedMap.set(name, result);
    return result;
  }

  function seededRandInt(name, min, max) {
    const hex = seededRandHex(name + '_int', 8);
    const num = parseInt(hex, 16);
    return min + (num % (max - min + 1));
  }

  function seededRandUUID(name) {
    const hex = seededRandHex(name + '_uuid', 32);
    return [
      hex.slice(0, 8), hex.slice(8, 12),
      '4' + hex.slice(13, 16),
      ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
      hex.slice(20, 32),
    ].join('-');
  }

  function seededRandAlphaNum(name, length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    let seed = simpleHash(name + document.domain);
    for (let i = 0; i < length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      result += chars[seed % chars.length];
    }
    return result;
  }

  function generateRandomValue(name) {
    // Format-aware generation for known cookies
    if (name === '_ga') return `GA1.2.${seededRandInt(name, 1000000000, 9999999999)}.${seededRandInt(name+'b', 1000000000, 9999999999)}`;
    if (/^_ga_.+$/.test(name)) return `GS1.1.${seededRandInt(name, 1000000000, 9999999999)}.${seededRandInt(name+'b', 1, 50)}.1.${seededRandInt(name+'c', 1000000000, 9999999999)}.0.0.0`;
    if (name === '_gid') return `GA1.2.${seededRandInt(name, 100000000, 999999999)}.${seededRandInt(name+'b', 1000000000, 9999999999)}`;
    if (/^_gat/.test(name)) return '1';
    if (name === '_fbp') return `fb.1.${Date.now() - seededRandInt(name, 0, 86400000)}.${seededRandInt(name+'b', 1000000000, 9999999999)}`;
    if (name === '_fbc') return `fb.1.${Date.now() - seededRandInt(name, 0, 86400000)}.${seededRandHex(name, 20)}`;
    if (name === 'fr') return `${seededRandAlphaNum(name, 22)}.${seededRandAlphaNum(name+'b', 22)}.${seededRandAlphaNum(name+'c', 6)}`;
    if (name === '_gcl_au') return `1.1.${seededRandInt(name, 100000000, 999999999)}.${seededRandInt(name+'b', 1000000000, 9999999999)}`;
    if (name === '_hjid' || name === 'ajs_anonymous_id' || name === '_rdt_uuid' || name === '_scid') return seededRandUUID(name);
    if (/^_hjSession_.+$/.test(name)) return JSON.stringify({ r: seededRandInt(name, 1, 999), c: Date.now() });
    if (/^_hjSessionUser_.+$/.test(name)) return seededRandUUID(name);
    if (/^mp_.+_mixpanel$/.test(name)) {
      return JSON.stringify({
        distinct_id: seededRandUUID(name),
        $device_id: seededRandHex(name + '_dev', 16),
        $initial_referrer: '$direct',
        $initial_referring_domain: '$direct',
      });
    }
    if (name === 'hubspotutk' || name === '_uetsid' || name === '_uetvid' || name === 'IDE') return seededRandHex(name, 32);
    if (name === '__hstc') return `${seededRandHex(name, 32)}.${seededRandInt(name, 1000000000, 9999999999)}.${Date.now()}.${Date.now()}.${Date.now()}.1`;

    // Default: hex string
    return seededRandHex(name, 32);
  }

  // Store the original descriptor
  const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (!originalDescriptor) return;

  Object.defineProperty(document, 'cookie', {
    get() {
      const raw = originalDescriptor.get.call(this);
      if (!raw) return raw;

      const pairs = raw.split(';').map(p => p.trim());
      const modified = pairs.map(pair => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) return pair;

        const name = pair.slice(0, eqIdx).trim();
        const value = pair.slice(eqIdx + 1).trim();

        if (isTrackingCookie(name)) {
          return `${name}=${generateRandomValue(name)}`;
        }
        return pair;
      });

      return modified.join('; ');
    },

    set(value) {
      if (!value || typeof value !== 'string') {
        return originalDescriptor.set.call(this, value);
      }

      const eqIdx = value.indexOf('=');
      if (eqIdx === -1) {
        return originalDescriptor.set.call(this, value);
      }

      const name = value.slice(0, eqIdx).trim();

      if (isTrackingCookie(name)) {
        // Parse the cookie string to replace just the value
        const semicolonIdx = value.indexOf(';');
        const randomValue = generateRandomValue(name);

        let newCookie;
        if (semicolonIdx === -1) {
          newCookie = `${name}=${randomValue}`;
        } else {
          const attributes = value.slice(semicolonIdx);
          newCookie = `${name}=${randomValue}${attributes}`;
        }

        return originalDescriptor.set.call(this, newCookie);
      }

      return originalDescriptor.set.call(this, value);
    },

    configurable: true,
  });
})();
