/**
 * CookieGhost — Cryptographically seeded random value generation
 */

const RandomGenerator = {
  /**
   * Crypto-seeded random integer in [min, max]
   */
  randInt(min, max) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return min + (array[0] % (max - min + 1));
  },

  /**
   * Random hex string of given length
   */
  randHex(length) {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
  },

  /**
   * Random alphanumeric string of given length
   */
  randAlphaNum(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => chars[b % chars.length]).join('');
  },

  /**
   * Random alphabetic string of given length
   */
  randAlpha(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => chars[b % chars.length]).join('');
  },

  /**
   * Random UUID v4
   */
  randUUID() {
    const hex = this.randHex(32);
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      '4' + hex.slice(13, 16),
      ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
      hex.slice(20, 32),
    ].join('-');
  },

  /**
   * Random base64 string from given number of random bytes
   */
  randBase64(byteLength) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  },

  /**
   * Recent timestamp (within last 24h)
   */
  recentTimestamp() {
    return Date.now() - this.randInt(0, 86400000);
  },

  /**
   * Date components for cookie formats
   */
  dateParts() {
    const d = new Date();
    return {
      year: d.getFullYear(),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      day: String(d.getDate()).padStart(2, '0'),
    };
  },
};

if (typeof globalThis !== 'undefined') {
  globalThis.RandomGenerator = RandomGenerator;
}
