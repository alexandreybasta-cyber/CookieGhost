/**
 * CookieGhost — Format-aware cookie value randomizer
 * Generates realistic random values that match expected tracking cookie formats.
 */

const COOKIE_FORMAT_GENERATORS = {
  // Google Analytics
  '_ga': () => `GA1.2.${RandomGenerator.randInt(1000000000, 9999999999)}.${RandomGenerator.randInt(1000000000, 9999999999)}`,
  '_gid': () => `GA1.2.${RandomGenerator.randInt(100000000, 999999999)}.${RandomGenerator.randInt(1000000000, 9999999999)}`,
  '_gat': () => '1',

  // Facebook
  '_fbp': () => `fb.1.${RandomGenerator.recentTimestamp()}.${RandomGenerator.randInt(1000000000, 9999999999)}`,
  '_fbc': () => `fb.1.${RandomGenerator.recentTimestamp()}.${RandomGenerator.randHex(20)}`,
  'fr': () => `${RandomGenerator.randAlphaNum(22)}.${RandomGenerator.randAlphaNum(22)}.${RandomGenerator.randAlphaNum(6)}`,
  'datr': () => RandomGenerator.randAlphaNum(24),
  'sb': () => RandomGenerator.randAlphaNum(24),

  // Google Ads
  '_gcl_au': () => `1.1.${RandomGenerator.randInt(100000000, 999999999)}.${RandomGenerator.randInt(1000000000, 9999999999)}`,
  '_gcl_aw': () => `GCL.${RandomGenerator.randInt(1000000000, 9999999999)}.${RandomGenerator.randHex(20)}`,
  '_gcl_dc': () => `GCL.${RandomGenerator.randInt(1000000000, 9999999999)}.${RandomGenerator.randHex(20)}`,

  // DoubleClick / Google
  'IDE': () => RandomGenerator.randHex(32),
  'DSID': () => RandomGenerator.randHex(16),
  'ANID': () => RandomGenerator.randHex(32),
  'NID': () => `${RandomGenerator.randInt(100, 999)}=${RandomGenerator.randAlphaNum(64)}`,
  '1P_JAR': () => {
    const d = RandomGenerator.dateParts();
    return `${d.year}-${d.month}-${d.day}-${RandomGenerator.randInt(10, 99)}`;
  },

  // Hotjar
  '_hjid': () => RandomGenerator.randUUID(),
  '_hjSessionUser': () => RandomGenerator.randUUID(),

  // Microsoft / Bing
  '_uetsid': () => RandomGenerator.randHex(32),
  '_uetvid': () => RandomGenerator.randHex(32),

  // Clarity
  '_clck': () => `${RandomGenerator.randAlphaNum(16)}|1|${RandomGenerator.randAlphaNum(8)}|0`,
  '_clsk': () => `${RandomGenerator.randAlphaNum(16)}|${RandomGenerator.randInt(1000000000, 9999999999)}|${RandomGenerator.randInt(1, 5)}|${RandomGenerator.randInt(0, 1)}`,

  // TikTok
  '_tt_enable_cookie': () => '1',
  '_ttp': () => RandomGenerator.randAlphaNum(24),

  // HubSpot
  'hubspotutk': () => RandomGenerator.randHex(32),
  '__hstc': () => `${RandomGenerator.randHex(32)}.${RandomGenerator.randInt(1000000000, 9999999999)}.${RandomGenerator.recentTimestamp()}.${RandomGenerator.recentTimestamp()}.${RandomGenerator.recentTimestamp()}.1`,
  '__hssc': () => `${RandomGenerator.randHex(32)}.${RandomGenerator.randInt(1, 20)}.${RandomGenerator.recentTimestamp()}`,
  '__hssrc': () => '1',

  // LinkedIn
  'li_sugr': () => RandomGenerator.randHex(32),
  'bcookie': () => `"v=2&${RandomGenerator.randHex(32)}"`,
  '_li_fat_id': () => RandomGenerator.randHex(32),

  // Segment
  'ajs_anonymous_id': () => RandomGenerator.randUUID(),
  'ajs_user_id': () => RandomGenerator.randUUID(),

  // Reddit
  '_rdt_uuid': () => RandomGenerator.randUUID(),

  // Snapchat
  '_scid': () => RandomGenerator.randUUID(),
  '_scid_r': () => RandomGenerator.randUUID(),
  'sc_anonymous_id': () => RandomGenerator.randUUID(),

  // Pinterest
  '_pin_unauth': () => RandomGenerator.randHex(32),
  '_derived_epik': () => RandomGenerator.randAlphaNum(32),

  // Marketo
  '_mkto_trk': () => `id:${RandomGenerator.randInt(100, 999)}-${RandomGenerator.randAlpha(3).toUpperCase()}-${RandomGenerator.randInt(100, 999)}&token:_mch-${RandomGenerator.randAlphaNum(16)}`,

  // Bizible
  '_biz_uid': () => RandomGenerator.randHex(32),
  '_biz_nA': () => `${RandomGenerator.randInt(1, 9)}`,

  // Google AdSense
  '__gads': () => `ID=${RandomGenerator.randHex(16)}:T=${RandomGenerator.randInt(1000000000, 9999999999)}:RT=${RandomGenerator.randInt(1000000000, 9999999999)}:S=ALNI_M${RandomGenerator.randAlphaNum(16)}`,
  '__gpi': () => `UID=${RandomGenerator.randHex(16)}:T=${RandomGenerator.randInt(1000000000, 9999999999)}:RT=${RandomGenerator.randInt(1000000000, 9999999999)}:S=ALNI_M${RandomGenerator.randAlphaNum(16)}`,

  // KISSmetrics
  'ki_r': () => RandomGenerator.randHex(32),
  'ki_t': () => `${RandomGenerator.randInt(1000000000, 9999999999)}%3B${RandomGenerator.randInt(1000000000, 9999999999)}%3B${RandomGenerator.randInt(1000000000, 9999999999)}%3B${RandomGenerator.randInt(1, 5)}%3B${RandomGenerator.randInt(1, 3)}`,

  // OptinMonster
  '_omappvp': () => RandomGenerator.randHex(32),
  '_omappvs': () => `${RandomGenerator.recentTimestamp()}`,

  // Google Analytics legacy
  '__utma': () => `${RandomGenerator.randInt(100000000, 999999999)}.${RandomGenerator.randInt(1000000000, 9999999999)}.${RandomGenerator.randInt(1000000000, 9999999999)}.${RandomGenerator.randInt(1000000000, 9999999999)}.${RandomGenerator.randInt(1000000000, 9999999999)}.${RandomGenerator.randInt(1, 50)}`,
  '__utmb': () => `${RandomGenerator.randInt(100000000, 999999999)}.${RandomGenerator.randInt(1, 10)}.10.${RandomGenerator.randInt(1000000000, 9999999999)}`,
  '__utmc': () => `${RandomGenerator.randInt(100000000, 999999999)}`,
  '__utmz': () => `${RandomGenerator.randInt(100000000, 999999999)}.${RandomGenerator.randInt(1000000000, 9999999999)}.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none)`,
  '__utmv': () => `${RandomGenerator.randInt(100000000, 999999999)}.|1=${RandomGenerator.randAlpha(8)}=user=1`,
};

// Wildcard pattern generators (for cookies like _ga_*, _hjSession_*, mp_*_mixpanel)
const WILDCARD_GENERATORS = [
  {
    pattern: /^_ga_.+$/,
    generate: () => `GS1.1.${RandomGenerator.randInt(1000000000, 9999999999)}.${RandomGenerator.randInt(1, 50)}.1.${RandomGenerator.randInt(1000000000, 9999999999)}.0.0.0`,
  },
  {
    pattern: /^_gac_.+$/,
    generate: () => `1.${RandomGenerator.randInt(1000000000, 9999999999)}.${RandomGenerator.randHex(20)}`,
  },
  {
    pattern: /^_hjSession_.+$/,
    generate: () => JSON.stringify({ r: RandomGenerator.randInt(1, 999), c: Date.now() }),
  },
  {
    pattern: /^_hjSessionUser_.+$/,
    generate: () => RandomGenerator.randUUID(),
  },
  {
    pattern: /^mp_.+_mixpanel$/,
    generate: () => JSON.stringify({
      distinct_id: RandomGenerator.randUUID(),
      $device_id: RandomGenerator.randHex(16),
      $initial_referrer: '$direct',
      $initial_referring_domain: '$direct',
    }),
  },
  {
    pattern: /^rdt_.+$/,
    generate: () => RandomGenerator.randHex(32),
  },
  {
    pattern: /^_gat_.+$/,
    generate: () => '1',
  },
  {
    pattern: /^_opt_.+$/,
    generate: () => RandomGenerator.randHex(16),
  },
];

/**
 * Generate a format-aware random value for a given cookie.
 * @param {string} cookieName - The name of the cookie
 * @param {string} originalValue - The original value (used for format detection)
 * @returns {string} A realistic random replacement value
 */
function generateRandomValue(cookieName, originalValue) {
  // Check exact match first
  if (COOKIE_FORMAT_GENERATORS[cookieName]) {
    return COOKIE_FORMAT_GENERATORS[cookieName]();
  }

  // Check wildcard patterns
  for (const wc of WILDCARD_GENERATORS) {
    if (wc.pattern.test(cookieName)) {
      return wc.generate();
    }
  }

  // Infer format from original value
  return inferAndGenerate(originalValue);
}

/**
 * Infer the format from the original value and generate a matching random value.
 */
function inferAndGenerate(originalValue) {
  if (!originalValue) return RandomGenerator.randHex(32);

  // UUID format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(originalValue)) {
    return RandomGenerator.randUUID();
  }

  // JSON value
  if (originalValue.startsWith('{') || originalValue.startsWith('[')) {
    try {
      JSON.parse(originalValue);
      // It's valid JSON — generate a UUID as the distinct_id
      return JSON.stringify({ id: RandomGenerator.randUUID() });
    } catch {
      // Not valid JSON, fall through
    }
  }

  // URL-encoded value
  if (originalValue.includes('%3B') || originalValue.includes('%3D')) {
    return originalValue.replace(/[0-9a-f]{8,}/gi, () => RandomGenerator.randHex(16));
  }

  // Long hex string
  if (/^[0-9a-f]{16,}$/i.test(originalValue)) {
    return RandomGenerator.randHex(originalValue.length);
  }

  // GA format
  if (/^GA\d\.\d\./.test(originalValue)) {
    return `GA1.2.${RandomGenerator.randInt(1000000000, 9999999999)}.${RandomGenerator.randInt(1000000000, 9999999999)}`;
  }

  // Facebook format
  if (/^fb\.\d\./.test(originalValue)) {
    return `fb.1.${RandomGenerator.recentTimestamp()}.${RandomGenerator.randInt(1000000000, 9999999999)}`;
  }

  // Numeric only (timestamp-like)
  if (/^\d{10,13}$/.test(originalValue)) {
    return `${RandomGenerator.recentTimestamp()}`;
  }

  // Base64-like
  if (/^[A-Za-z0-9+/]{20,}={0,2}$/.test(originalValue)) {
    return RandomGenerator.randBase64(Math.ceil(originalValue.length * 0.75));
  }

  // Alphanumeric — match length
  if (/^[A-Za-z0-9]+$/.test(originalValue)) {
    return RandomGenerator.randAlphaNum(originalValue.length);
  }

  // Default: hex of same length
  return RandomGenerator.randHex(Math.max(originalValue.length, 16));
}

if (typeof globalThis !== 'undefined') {
  globalThis.CookieRandomizer = {
    generateRandomValue,
  };
}
