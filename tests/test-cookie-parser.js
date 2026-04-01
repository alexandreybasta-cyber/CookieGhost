/**
 * CookieGhost — Cookie parser tests
 * Run in browser console or Node.js with the parser loaded.
 */

// Minimal test runner
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

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

function test(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// Load parser if in a context where it's available
if (typeof CookieParser === 'undefined') {
  console.log('CookieParser not found — load lib/cookie-parser.js first');
}

// Tests
test('parseSetCookie — basic cookie', () => {
  const result = CookieParser.parseSetCookie('_ga=GA1.2.123.456');
  assertEqual(result.name, '_ga', 'name');
  assertEqual(result.value, 'GA1.2.123.456', 'value');
});

test('parseSetCookie — full attributes', () => {
  const result = CookieParser.parseSetCookie(
    'session=abc123; Path=/; Domain=.example.com; Secure; HttpOnly; SameSite=Lax; Max-Age=3600'
  );
  assertEqual(result.name, 'session', 'name');
  assertEqual(result.value, 'abc123', 'value');
  assertEqual(result.path, '/', 'path');
  assertEqual(result.domain, '.example.com', 'domain');
  assertEqual(result.secure, true, 'secure');
  assertEqual(result.httpOnly, true, 'httpOnly');
  assertEqual(result.sameSite, 'lax', 'sameSite');
  assertEqual(result.maxAge, 3600, 'maxAge');
});

test('parseSetCookie — value with equals sign', () => {
  const result = CookieParser.parseSetCookie('token=abc=def=ghi; Path=/');
  assertEqual(result.name, 'token', 'name');
  assertEqual(result.value, 'abc=def=ghi', 'value with equals');
});

test('parseSetCookie — empty/null input', () => {
  assertEqual(CookieParser.parseSetCookie(null), null, 'null input');
  assertEqual(CookieParser.parseSetCookie(''), null, 'empty string');
  assertEqual(CookieParser.parseSetCookie(undefined), null, 'undefined input');
});

test('serializeSetCookie — round-trip', () => {
  const original = 'session=abc123; Domain=.example.com; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax';
  const parsed = CookieParser.parseSetCookie(original);
  const serialized = CookieParser.serializeSetCookie(parsed);
  assert(serialized.includes('session=abc123'), 'contains name=value');
  assert(serialized.includes('Domain=.example.com'), 'contains domain');
  assert(serialized.includes('Secure'), 'contains Secure');
  assert(serialized.includes('HttpOnly'), 'contains HttpOnly');
  assert(serialized.includes('SameSite=Lax'), 'contains SameSite');
});

test('parseCookieHeader — multiple cookies', () => {
  const result = CookieParser.parseCookieHeader('_ga=GA1.2.123.456; session=abc; _fbp=fb.1.123.456');
  assertEqual(result.length, 3, 'three cookies');
  assertEqual(result[0].name, '_ga', 'first cookie name');
  assertEqual(result[1].name, 'session', 'second cookie name');
  assertEqual(result[2].name, '_fbp', 'third cookie name');
});

test('parseCookieHeader — empty input', () => {
  assertEqual(CookieParser.parseCookieHeader('').length, 0, 'empty string');
  assertEqual(CookieParser.parseCookieHeader(null).length, 0, 'null');
});

test('serializeCookieHeader — round-trip', () => {
  const cookies = [
    { name: '_ga', value: 'GA1.2.123.456' },
    { name: 'session', value: 'abc123' },
  ];
  const result = CookieParser.serializeCookieHeader(cookies);
  assertEqual(result, '_ga=GA1.2.123.456; session=abc123', 'serialized header');
});

test('isThirdParty — same domain', () => {
  assertEqual(CookieParser.isThirdParty('.example.com', 'https://example.com/page'), false, 'same domain');
  assertEqual(CookieParser.isThirdParty('.example.com', 'https://sub.example.com/page'), false, 'subdomain');
  assertEqual(CookieParser.isThirdParty('example.com', 'https://example.com/page'), false, 'exact match');
});

test('isThirdParty — different domain', () => {
  assertEqual(CookieParser.isThirdParty('.tracker.com', 'https://example.com/page'), true, 'different domain');
  assertEqual(CookieParser.isThirdParty('.google-analytics.com', 'https://example.com/page'), true, 'analytics domain');
});

test('hasLongExpiration — checks days threshold', () => {
  assertEqual(CookieParser.hasLongExpiration({ maxAge: 86400 * 30 }, 7), true, '30 day maxAge');
  assertEqual(CookieParser.hasLongExpiration({ maxAge: 3600 }, 7), false, '1 hour maxAge');
  assertEqual(CookieParser.hasLongExpiration({ maxAge: null, expires: null }, 7), false, 'session cookie');
});

test('isShortLived — checks minutes threshold', () => {
  assertEqual(CookieParser.isShortLived({ maxAge: 60 }, 30), true, '1 minute');
  assertEqual(CookieParser.isShortLived({ maxAge: 86400 }, 30), false, '1 day');
  assertEqual(CookieParser.isShortLived({ maxAge: null, expires: null }, 30), true, 'session cookie');
});

// Summary
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);
