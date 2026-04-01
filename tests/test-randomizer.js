/**
 * CookieGhost — Cookie randomizer tests
 * Validates that generated values match expected formats.
 *
 * To run: Load lib/random-generator.js and background/cookie-randomizer.js first.
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertMatch(value, regex, message) {
  assert(regex.test(value), `${message}: "${value}" matches ${regex}`);
}

function test(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// RandomGenerator helper tests
test('RandomGenerator.randInt — range', () => {
  for (let i = 0; i < 50; i++) {
    const val = RandomGenerator.randInt(10, 20);
    assert(val >= 10 && val <= 20, `randInt(10,20) = ${val}`);
  }
});

test('RandomGenerator.randHex — length and charset', () => {
  for (const len of [8, 16, 32, 64]) {
    const hex = RandomGenerator.randHex(len);
    assert(hex.length === len, `randHex(${len}).length = ${hex.length}`);
    assertMatch(hex, /^[0-9a-f]+$/i, `randHex(${len}) is hex`);
  }
});

test('RandomGenerator.randAlphaNum — length and charset', () => {
  for (const len of [8, 16, 24]) {
    const val = RandomGenerator.randAlphaNum(len);
    assert(val.length === len, `randAlphaNum(${len}).length = ${val.length}`);
    assertMatch(val, /^[A-Za-z0-9]+$/, `randAlphaNum(${len}) is alphanumeric`);
  }
});

test('RandomGenerator.randUUID — format', () => {
  for (let i = 0; i < 10; i++) {
    const uuid = RandomGenerator.randUUID();
    assertMatch(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'UUID v4 format');
  }
});

// Format-aware value generation
test('_ga format', () => {
  const val = CookieRandomizer.generateRandomValue('_ga', 'GA1.2.123.456');
  assertMatch(val, /^GA1\.2\.\d{10}\.\d{10}$/, '_ga format');
});

test('_gid format', () => {
  const val = CookieRandomizer.generateRandomValue('_gid', 'GA1.2.123.456');
  assertMatch(val, /^GA1\.2\.\d{9}\.\d{10}$/, '_gid format');
});

test('_ga_* wildcard format', () => {
  const val = CookieRandomizer.generateRandomValue('_ga_ABC123', 'GS1.1.123.5.1.123.0.0.0');
  assertMatch(val, /^GS1\.1\.\d+\.\d+\.1\.\d+\.0\.0\.0$/, '_ga_* format');
});

test('_fbp format', () => {
  const val = CookieRandomizer.generateRandomValue('_fbp', 'fb.1.123.456');
  assertMatch(val, /^fb\.1\.\d+\.\d{10}$/, '_fbp format');
});

test('_fbc format', () => {
  const val = CookieRandomizer.generateRandomValue('_fbc', 'fb.1.123.abc');
  assertMatch(val, /^fb\.1\.\d+\.[0-9a-f]{20}$/, '_fbc format');
});

test('fr format', () => {
  const val = CookieRandomizer.generateRandomValue('fr', 'abc.def.ghi');
  assertMatch(val, /^[A-Za-z0-9]{22}\.[A-Za-z0-9]{22}\.[A-Za-z0-9]{6}$/, 'fr format');
});

test('_gcl_au format', () => {
  const val = CookieRandomizer.generateRandomValue('_gcl_au', '1.1.123.456');
  assertMatch(val, /^1\.1\.\d{9}\.\d{10}$/, '_gcl_au format');
});

test('_hjid — UUID format', () => {
  const val = CookieRandomizer.generateRandomValue('_hjid', 'old-uuid');
  assertMatch(val, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '_hjid UUID');
});

test('_hjSession_* — JSON format', () => {
  const val = CookieRandomizer.generateRandomValue('_hjSession_12345', '{}');
  try {
    const parsed = JSON.parse(val);
    assert(typeof parsed.r === 'number', 'has r field');
    assert(typeof parsed.c === 'number', 'has c field');
  } catch {
    assert(false, `_hjSession value is valid JSON: ${val}`);
  }
});

test('mp_*_mixpanel — JSON format', () => {
  const val = CookieRandomizer.generateRandomValue('mp_abc_mixpanel', '{}');
  try {
    const parsed = JSON.parse(val);
    assert(typeof parsed.distinct_id === 'string', 'has distinct_id');
    assert(typeof parsed.$device_id === 'string', 'has $device_id');
  } catch {
    assert(false, `mixpanel value is valid JSON: ${val}`);
  }
});

test('hubspotutk — hex32 format', () => {
  const val = CookieRandomizer.generateRandomValue('hubspotutk', 'abc123');
  assertMatch(val, /^[0-9a-f]{32}$/i, 'hubspotutk hex32');
});

test('__hstc format', () => {
  const val = CookieRandomizer.generateRandomValue('__hstc', 'abc.123.456.789.012.1');
  assertMatch(val, /^[0-9a-f]{32}\.\d+\.\d+\.\d+\.\d+\.1$/, '__hstc format');
});

test('__gads format', () => {
  const val = CookieRandomizer.generateRandomValue('__gads', 'ID=abc:T=123');
  assert(val.startsWith('ID='), '__gads starts with ID=');
  assert(val.includes(':T='), '__gads contains :T=');
  assert(val.includes(':S=ALNI_M'), '__gads contains :S=ALNI_M');
});

// Uniqueness — different calls produce different values
test('Uniqueness — repeated calls produce different values', () => {
  const values = new Set();
  for (let i = 0; i < 20; i++) {
    values.add(CookieRandomizer.generateRandomValue('_ga', 'GA1.2.123.456'));
  }
  assert(values.size > 1, `${values.size} unique values from 20 calls`);
});

// Value inference for unknown cookies
test('Inferred format — UUID value', () => {
  const val = CookieRandomizer.generateRandomValue('unknown_cookie', '550e8400-e29b-41d4-a716-446655440000');
  assertMatch(val, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'inferred UUID');
});

test('Inferred format — hex value', () => {
  const val = CookieRandomizer.generateRandomValue('unknown_cookie', 'abcdef1234567890abcdef1234567890');
  assertMatch(val, /^[0-9a-f]{32}$/i, 'inferred hex32');
});

test('Inferred format — GA value', () => {
  const val = CookieRandomizer.generateRandomValue('unknown_cookie', 'GA1.2.9876543210.1234567890');
  assertMatch(val, /^GA1\.2\.\d+\.\d+$/, 'inferred GA format');
});

// Summary
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);
