/**
 * CookieGhost — Cookie classifier tests
 * Tests the classification logic for tracking vs functional cookies.
 *
 * To run: Load all background scripts in a browser console, then load this file.
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

function test(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// Known tracking cookies should be randomized
test('Known tracking cookies → randomize', () => {
  const trackingCookies = [
    '_ga', '_gid', '_fbp', '_fbc', 'fr', 'datr', '_gcl_au',
    'IDE', '_hjid', '_uetsid', '_uetvid', '_ttp', 'hubspotutk',
    '__hstc', '_clck', 'ajs_anonymous_id', '_rdt_uuid', '_scid',
  ];

  for (const name of trackingCookies) {
    const result = CookieClassifier.classifyCookie(
      { name, value: 'test123', domain: '.example.com' },
      { url: 'https://example.com/' }
    );
    assert(result.action === 'randomize', `${name} → ${result.action} (${result.reason})`);
  }
});

// Wildcard tracking patterns
test('Wildcard tracking patterns → randomize', () => {
  const wildcards = [
    '_ga_ABC123', '_gac_UA12345', '_hjSession_12345',
    '_hjSessionUser_12345', 'mp_abc123_mixpanel', 'rdt_test',
  ];

  for (const name of wildcards) {
    const result = CookieClassifier.classifyCookie(
      { name, value: 'test', domain: '.example.com' },
      { url: 'https://example.com/' }
    );
    assert(result.action === 'randomize', `${name} → ${result.action} (${result.reason})`);
  }
});

// Known functional cookies must NEVER be randomized
test('Known functional cookies → preserve', () => {
  const functionalCookies = [
    'PHPSESSID', 'JSESSIONID', 'ASP.NET_SessionId', 'connect.sid',
    'csrftoken', '_csrf', 'XSRF-TOKEN', 'laravel_session',
    '__cf_bm', 'cf_clearance', 'AWSALB', 'AWSALBCORS',
  ];

  for (const name of functionalCookies) {
    const result = CookieClassifier.classifyCookie(
      { name, value: 'abc123', domain: '.example.com' },
      { url: 'https://example.com/' }
    );
    assert(result.action === 'preserve', `${name} → ${result.action} (${result.reason})`);
  }
});

// Wildcard functional patterns
test('Wildcard functional patterns → preserve', () => {
  const wildcards = [
    '__Host-session', '__Secure-token', 'wordpress_logged_in_abc',
    'wp-settings-1',
  ];

  for (const name of wildcards) {
    const result = CookieClassifier.classifyCookie(
      { name, value: 'test', domain: '.example.com' },
      { url: 'https://example.com/' }
    );
    assert(result.action === 'preserve', `${name} → ${result.action} (${result.reason})`);
  }
});

// Auth-like cookies with strong signals should be preserved
test('Strong auth signals → preserve', () => {
  const result = CookieClassifier.classifyCookie(
    {
      name: 'my_custom_auth',
      value: 'token123',
      domain: '.example.com',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    },
    { url: 'https://example.com/' }
  );
  assert(result.action === 'preserve', `HttpOnly+Secure+Strict → ${result.action} (${result.reason})`);
});

// Tracker domains should trigger randomization
test('Tracker domain cookies → randomize', () => {
  const result = CookieClassifier.classifyCookie(
    { name: 'unknown_cookie', value: 'abc', domain: '.doubleclick.net' },
    { url: 'https://ad.doubleclick.net/pixel' }
  );
  assert(result.action === 'randomize', `doubleclick.net → ${result.action} (${result.reason})`);
});

// Tracking value patterns
test('Tracking ID value patterns → randomize', () => {
  const trackingValues = [
    { name: 'unknown1', value: 'GA1.2.1234567890.9876543210' },
    { name: 'unknown2', value: '550e8400-e29b-41d4-a716-446655440000' },
    { name: 'unknown3', value: 'abcdef1234567890abcdef1234567890ab' },
    { name: 'unknown4', value: 'fb.1.1234567890.9876543210' },
  ];

  for (const cookie of trackingValues) {
    const result = CookieClassifier.classifyCookie(
      { ...cookie, domain: '.example.com' },
      { url: 'https://example.com/' }
    );
    assert(result.action === 'randomize', `"${cookie.value.slice(0, 20)}..." → ${result.action} (${result.reason})`);
  }
});

// First-party session cookies should be preserved
test('First-party session cookies → preserve', () => {
  const result = CookieClassifier.classifyCookie(
    { name: 'my_pref', value: 'dark', domain: 'example.com', maxAge: null, expires: null },
    { url: 'https://example.com/' }
  );
  assert(result.action === 'preserve', `First-party session → ${result.action} (${result.reason})`);
});

// Summary
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);
