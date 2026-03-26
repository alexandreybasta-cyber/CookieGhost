/**
 * CookieGhost — Cookie header parsing and serialization
 */

const CookieParser = {
  /**
   * Parse a Set-Cookie header value into a structured object.
   * Example: "name=value; Path=/; Domain=.example.com; Secure; HttpOnly; SameSite=Lax; Max-Age=3600"
   */
  parseSetCookie(headerValue) {
    if (!headerValue || typeof headerValue !== 'string') {
      return null;
    }

    const parts = headerValue.split(';').map(p => p.trim());
    const [nameValue, ...attributes] = parts;

    const eqIndex = nameValue.indexOf('=');
    if (eqIndex === -1) return null;

    const name = nameValue.slice(0, eqIndex).trim();
    const value = nameValue.slice(eqIndex + 1).trim();

    const cookie = {
      name,
      value,
      domain: '',
      path: '/',
      secure: false,
      httpOnly: false,
      sameSite: 'none',
      maxAge: null,
      expires: null,
    };

    for (const attr of attributes) {
      const lower = attr.toLowerCase();
      if (lower === 'secure') {
        cookie.secure = true;
      } else if (lower === 'httponly') {
        cookie.httpOnly = true;
      } else {
        const attrEq = attr.indexOf('=');
        if (attrEq !== -1) {
          const attrName = attr.slice(0, attrEq).trim().toLowerCase();
          const attrValue = attr.slice(attrEq + 1).trim();

          switch (attrName) {
            case 'domain':
              cookie.domain = attrValue;
              break;
            case 'path':
              cookie.path = attrValue;
              break;
            case 'samesite':
              cookie.sameSite = attrValue.toLowerCase();
              break;
            case 'max-age':
              cookie.maxAge = parseInt(attrValue, 10);
              break;
            case 'expires':
              cookie.expires = attrValue;
              break;
          }
        }
      }
    }

    return cookie;
  },

  /**
   * Serialize a parsed Set-Cookie object back to a header string.
   */
  serializeSetCookie(cookie) {
    let str = `${cookie.name}=${cookie.value}`;

    if (cookie.domain) str += `; Domain=${cookie.domain}`;
    if (cookie.path) str += `; Path=${cookie.path}`;
    if (cookie.maxAge !== null) str += `; Max-Age=${cookie.maxAge}`;
    if (cookie.expires) str += `; Expires=${cookie.expires}`;
    if (cookie.secure) str += '; Secure';
    if (cookie.httpOnly) str += '; HttpOnly';
    if (cookie.sameSite && cookie.sameSite !== 'none') {
      str += `; SameSite=${cookie.sameSite.charAt(0).toUpperCase() + cookie.sameSite.slice(1)}`;
    }

    return str;
  },

  /**
   * Parse a Cookie request header into an array of {name, value} pairs.
   * Example: "name1=value1; name2=value2; name3=value3"
   */
  parseCookieHeader(headerValue) {
    if (!headerValue || typeof headerValue !== 'string') {
      return [];
    }

    return headerValue.split(';').map(pair => {
      const trimmed = pair.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        return { name: trimmed, value: '' };
      }
      return {
        name: trimmed.slice(0, eqIndex).trim(),
        value: trimmed.slice(eqIndex + 1).trim(),
      };
    }).filter(c => c.name.length > 0);
  },

  /**
   * Serialize an array of {name, value} pairs into a Cookie header string.
   */
  serializeCookieHeader(cookies) {
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  },

  /**
   * Parse a single document.cookie set string (name=value with optional attributes).
   */
  parseSingleCookie(cookieString) {
    return this.parseSetCookie(cookieString);
  },

  /**
   * Serialize a single cookie for document.cookie setter.
   */
  serializeSingleCookie(cookie) {
    return this.serializeSetCookie(cookie);
  },

  /**
   * Extract the effective domain from a URL.
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  },

  /**
   * Determine if a cookie is third-party relative to a page URL.
   */
  isThirdParty(cookieDomain, pageUrl) {
    const pageDomain = this.extractDomain(pageUrl);
    if (!pageDomain || !cookieDomain) return false;

    const cleanCookieDomain = cookieDomain.startsWith('.')
      ? cookieDomain.slice(1)
      : cookieDomain;

    // Same domain or subdomain match
    if (pageDomain === cleanCookieDomain) return false;
    if (pageDomain.endsWith('.' + cleanCookieDomain)) return false;

    return true;
  },

  /**
   * Check if a cookie's expiration is longer than the given number of days.
   */
  hasLongExpiration(cookie, days = 7) {
    const thresholdMs = days * 24 * 60 * 60 * 1000;

    if (cookie.maxAge !== null) {
      return cookie.maxAge * 1000 > thresholdMs;
    }

    if (cookie.expires) {
      const expiresDate = new Date(cookie.expires).getTime();
      return (expiresDate - Date.now()) > thresholdMs;
    }

    // Session cookie (no expiration) — not long-lived
    return false;
  },

  /**
   * Check if a cookie is session-scoped (no explicit expiration).
   */
  isSessionCookie(cookie) {
    return cookie.maxAge === null && !cookie.expires;
  },

  /**
   * Check if a cookie has short expiration (< given minutes).
   */
  isShortLived(cookie, minutes = 30) {
    const thresholdMs = minutes * 60 * 1000;

    if (cookie.maxAge !== null) {
      return cookie.maxAge * 1000 < thresholdMs;
    }

    if (cookie.expires) {
      const expiresDate = new Date(cookie.expires).getTime();
      return (expiresDate - Date.now()) < thresholdMs;
    }

    return true; // Session cookies are short-lived
  },
};

if (typeof globalThis !== 'undefined') {
  globalThis.CookieParser = CookieParser;
}
