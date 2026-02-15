const { isRealContent, isSoft404 } = require('../src/lib/content-extractor');

describe('isRealContent', () => {
  test('rejects HTTP 4xx/5xx status', () => {
    expect(isRealContent('<html><body>Normal page content here that is long enough</body></html>'.repeat(20), 404)).toBe(false);
    expect(isRealContent('<html><body>Server error content</body></html>'.repeat(20), 500)).toBe(false);
  });

  test('rejects very short HTML (< 500 chars)', () => {
    expect(isRealContent('<html><body>Short</body></html>', 200)).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(isRealContent(null, 200)).toBe(false);
    expect(isRealContent(undefined, 200)).toBe(false);
    expect(isRealContent(42, 200)).toBe(false);
  });

  test('rejects Vercel Security Checkpoint', () => {
    const html = '<html><head><title>Vercel Security Checkpoint</title></head><body>' + 'x'.repeat(600) + '</body></html>';
    expect(isRealContent(html, 200)).toBe(false);
  });

  test('rejects Cloudflare challenge', () => {
    const html = '<html><body><div class="cf-challenge-running">Please wait</div>' + 'x'.repeat(600) + '</body></html>';
    expect(isRealContent(html, 200)).toBe(false);
  });

  test('rejects DDoS-Guard pages', () => {
    const html = '<html><body>DDoS-Guard checking your browser' + 'x'.repeat(600) + '</body></html>';
    expect(isRealContent(html, 200)).toBe(false);
  });

  test('rejects "just a moment" + "enable javascript" combo', () => {
    const html = '<html><body>Just a moment... Please enable JavaScript' + 'x'.repeat(600) + '</body></html>';
    expect(isRealContent(html, 200)).toBe(false);
  });

  test('accepts valid HTML with real content', () => {
    const html = '<html><head><title>About Us</title></head><body><main><h1>About Our Company</h1><p>' + 'Real content here. '.repeat(50) + '</p></main></body></html>';
    expect(isRealContent(html, 200)).toBe(true);
  });

  test('accepts valid HTML with no status provided', () => {
    const html = '<html><head><title>Page</title></head><body>' + 'Content '.repeat(100) + '</body></html>';
    expect(isRealContent(html)).toBe(true);
  });
});

describe('isSoft404', () => {
  test('detects very short text as soft 404', () => {
    expect(isSoft404('<html><body><p>Oops</p></body></html>')).toBe(true);
  });

  test('detects "page not found" in short page', () => {
    const html = '<html><body><h1>Page not found</h1><p>Sorry, this page does not exist.</p></body></html>';
    expect(isSoft404(html)).toBe(true);
  });

  test('detects "page introuvable" in short page', () => {
    const html = '<html><body><h1>Page introuvable</h1><p>Cette page n\'existe pas.</p></body></html>';
    expect(isSoft404(html)).toBe(true);
  });

  test('detects "404" in short page', () => {
    const html = '<html><body><h1>404</h1><p>The page you requested was not found.</p></body></html>';
    expect(isSoft404(html)).toBe(true);
  });

  test('rejects non-string input', () => {
    expect(isSoft404(null)).toBe(true);
    expect(isSoft404(undefined)).toBe(true);
  });

  test('does NOT flag long real pages that happen to mention 404', () => {
    const longContent = 'This is a real article about HTTP status codes. ' +
      'The 404 error is common. '.repeat(30) +
      'Many servers return 404 when a resource is not found.';
    const html = '<html><body><article>' + longContent + '</article></body></html>';
    expect(isSoft404(html)).toBe(false);
  });

  test('does NOT flag real pages with enough content', () => {
    const html = '<html><body><main>' + '<p>Paragraph of real content about our company.</p>'.repeat(10) + '</main></body></html>';
    expect(isSoft404(html)).toBe(false);
  });

  test('strips script and style tags before measuring', () => {
    const html = '<html><body><script>var x = "' + 'a'.repeat(1000) + '";</script><p>Short</p></body></html>';
    expect(isSoft404(html)).toBe(true);
  });
});
