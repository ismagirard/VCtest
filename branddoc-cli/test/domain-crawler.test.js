// Tests for domain-crawler.js
// Pure helpers (normalizeDomain, looksLikeXml) are tested directly.
// crawlDomain is tested with mocked network dependencies.

jest.mock('axios');
jest.mock('../src/lib/scrapeowl-client', () => ({
  fetchViaScrapeOwl: jest.fn(),
}));
jest.mock('../src/lib/sitemap-parser', () => ({
  parseSitemapXml: jest.fn(),
}));

const axios = require('axios');
const { fetchViaScrapeOwl } = require('../src/lib/scrapeowl-client');
const { parseSitemapXml } = require('../src/lib/sitemap-parser');
const { crawlDomain, normalizeDomain, looksLikeXml } = require('../src/lib/domain-crawler');

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── normalizeDomain (pure) ─────────────────────────────────────────
describe('normalizeDomain', () => {
  test('adds https:// when missing', () => {
    expect(normalizeDomain('example.com')).toBe('https://example.com');
  });

  test('preserves existing https://', () => {
    expect(normalizeDomain('https://example.com')).toBe('https://example.com');
  });

  test('preserves existing http://', () => {
    expect(normalizeDomain('http://example.com')).toBe('http://example.com');
  });

  test('strips trailing slashes', () => {
    expect(normalizeDomain('example.com/')).toBe('https://example.com');
    expect(normalizeDomain('example.com///')).toBe('https://example.com');
  });

  test('trims whitespace', () => {
    expect(normalizeDomain('  example.com  ')).toBe('https://example.com');
  });
});

// ─── looksLikeXml (pure) ────────────────────────────────────────────
describe('looksLikeXml', () => {
  test('recognizes <?xml declaration', () => {
    expect(looksLikeXml('<?xml version="1.0"?><urlset></urlset>')).toBe(true);
  });

  test('recognizes <urlset root element', () => {
    expect(looksLikeXml('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
  });

  test('recognizes <sitemapindex root element', () => {
    expect(looksLikeXml('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
  });

  test('rejects HTML', () => {
    expect(looksLikeXml('<html><body>Not a sitemap</body></html>')).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(looksLikeXml(null)).toBe(false);
    expect(looksLikeXml(undefined)).toBe(false);
    expect(looksLikeXml(42)).toBe(false);
  });

  test('handles leading whitespace before xml declaration', () => {
    expect(looksLikeXml('  <?xml version="1.0"?><urlset></urlset>')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(looksLikeXml('')).toBe(false);
  });
});

// ─── crawlDomain (mocked) ───────────────────────────────────────────
describe('crawlDomain', () => {
  // Pad XML to > 100 chars so fetchWithFallback's length check passes
  const validSitemapXml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    '<url><loc>https://example.com/</loc></url>' +
    '<url><loc>https://example.com/about</loc></url>' +
    '</urlset>';

  test('returns sitemap URLs when sitemap.xml is found', async () => {
    // Googlebot fetch returns valid XML (> 100 chars to pass fetchWithFallback check)
    axios.get.mockResolvedValue({ data: validSitemapXml });

    parseSitemapXml.mockReturnValue({
      type: 'urlset',
      entries: ['https://example.com/', 'https://example.com/about'],
    });

    const result = await crawlDomain('example.com');
    expect(result.source).toBe('sitemap');
    expect(result.urls).toContain('https://example.com/');
    expect(result.urls).toContain('https://example.com/about');
  });

  test('falls back to homepage link extraction when no sitemap', async () => {
    // ScrapeOWL always fails
    fetchViaScrapeOwl.mockRejectedValue(new Error('No API key'));

    // Route all Googlebot fetches — only homepage returns HTML
    axios.get.mockImplementation(async (url) => {
      if (url === 'https://example.com') {
        return {
          data: `<html><body>
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="/blog">Blog</a>
            <a href="https://other-site.com/external">External</a>
          </body></html>`.repeat(5), // > 500 chars
        };
      }
      throw new Error('404');
    });

    const result = await crawlDomain('example.com');
    expect(result.source).toBe('homepage-links');
    expect(result.urls).toContain('https://example.com');
    expect(result.urls).toContain('https://example.com/about');
    expect(result.urls).toContain('https://example.com/blog');
    // External links excluded
    expect(result.urls).not.toContain('https://other-site.com/external');
  });

  test('tries robots.txt sitemaps when standard paths fail', async () => {
    // Route Googlebot fetches by URL pattern
    axios.get.mockImplementation(async (url) => {
      // Standard sitemap paths return short non-XML HTML
      if (url.includes('sitemap_index.xml') || (url.includes('sitemap.xml') && !url.includes('special'))) {
        return { data: '<html>Not found</html>' };
      }
      // robots.txt returns sitemap directive
      if (url.includes('robots.txt')) {
        return { data: 'User-Agent: *\nDisallow:\nSitemap: https://example.com/special-sitemap.xml' };
      }
      // Special sitemap returns valid long XML
      if (url.includes('special-sitemap.xml')) {
        return { data: validSitemapXml.replace(/example\.com/g, 'example.com') };
      }
      throw new Error('Not found');
    });

    // parseSitemapXml: only return entries for valid sitemap XML
    parseSitemapXml.mockImplementation((xml) => {
      if (xml.includes('<urlset')) {
        return { type: 'urlset', entries: ['https://example.com/found'] };
      }
      return { type: 'unknown', entries: [] };
    });

    // ScrapeOWL fallback not needed — Googlebot handles everything
    fetchViaScrapeOwl.mockRejectedValue(new Error('Not needed'));

    const result = await crawlDomain('example.com');
    expect(result.source).toBe('sitemap');
    expect(result.urls).toContain('https://example.com/found');
  });
});
