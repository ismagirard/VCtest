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
    // Discovery metadata is present
    expect(result.discovery).toBeDefined();
    expect(result.discovery.sitemapsAttempted).toBeInstanceOf(Array);
    expect(result.discovery.sitemapsAttempted.length).toBeGreaterThan(0);
    expect(result.discovery.sitemapsAttempted[0].status).toBe('success');
    expect(result.discovery.sitemapsAttempted[0].urlCount).toBe(2);
    expect(result.discovery.warnings).toBeInstanceOf(Array);
  });

  test('falls back to deep link crawl when no sitemap', async () => {
    // ScrapeOWL always fails
    fetchViaScrapeOwl.mockRejectedValue(new Error('No API key'));

    // Build a realistic HTML page (> 500 chars) with internal links
    const homepageHtml = `<html><body>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/blog">Blog</a>
      <a href="/contact">Contact</a>
      <a href="https://other-site.com/external">External</a>
    </body></html>`.repeat(5); // > 500 chars

    // Route all Googlebot fetches:
    // - Sitemap paths return short HTML (not XML)
    // - Homepage returns rich HTML with links
    // - Sub-pages return smaller HTML (some with further links)
    axios.get.mockImplementation(async (url) => {
      if (url === 'https://example.com') {
        return { data: homepageHtml };
      }
      // Sub-pages for deep crawl: return HTML with some links (> 200 chars to pass check)
      if (url === 'https://example.com/about' || url === 'https://example.com/blog'
          || url === 'https://example.com/contact') {
        return {
          data: '<html><body><h1>Page</h1><p>' + 'Content '.repeat(30) + '</p>'
            + '<a href="/team">Team</a></body></html>',
        };
      }
      if (url === 'https://example.com/team') {
        return {
          data: '<html><body><h1>Team</h1><p>' + 'Content '.repeat(30) + '</p></body></html>',
        };
      }
      // robots.txt returns empty / no User-Agent
      if (url.includes('robots.txt')) {
        return { data: '# no sitemap' };
      }
      // All sitemap paths fail
      throw new Error('404');
    });

    const result = await crawlDomain('example.com');
    expect(result.source).toBe('deep-crawl');
    // Should find homepage + internal links + links from sub-pages
    expect(result.urls).toContain('https://example.com');
    expect(result.urls).toContain('https://example.com/about');
    expect(result.urls).toContain('https://example.com/blog');
    expect(result.urls).toContain('https://example.com/contact');
    // Deep crawl should also discover links from sub-pages
    expect(result.urls).toContain('https://example.com/team');
    // External links excluded
    expect(result.urls).not.toContain('https://other-site.com/external');
    // Discovery metadata is present
    expect(result.discovery).toBeDefined();
    expect(result.discovery.sitemapsAttempted.length).toBeGreaterThan(0);
    // All sitemap attempts should have failed
    for (const sm of result.discovery.sitemapsAttempted) {
      expect(sm.status).not.toBe('success');
    }
    // Deep crawl metadata present
    expect(result.discovery.deepCrawl).toBeDefined();
    expect(result.discovery.deepCrawl.seedUrls).toBeGreaterThan(0);
    expect(result.discovery.deepCrawl.totalDiscovered).toBeGreaterThan(0);
  }, 30000);

  test('tries robots.txt sitemaps when standard paths fail', async () => {
    // Route Googlebot fetches by URL pattern
    axios.get.mockImplementation(async (url) => {
      // Standard sitemap paths return short non-XML HTML
      if (url.includes('sitemap') && !url.includes('special') && !url.includes('robots')) {
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
    // Discovery includes robots.txt info
    expect(result.discovery).toBeDefined();
    expect(result.discovery.robotsTxt.found).toBe(true);
    expect(result.discovery.robotsTxt.sitemapDirectives).toContain('https://example.com/special-sitemap.xml');
  });

  test('reports warnings when child sitemaps fail in a sitemap index', async () => {
    const indexXml = '<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '<sitemap><loc>https://example.com/child-1.xml</loc></sitemap>' +
      '<sitemap><loc>https://example.com/child-2.xml</loc></sitemap>' +
      '</sitemapindex>' + ' '.repeat(50); // pad to > 100 chars

    const childUrlsetXml = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '<url><loc>https://example.com/page1</loc></url>' +
      '</urlset>' + ' '.repeat(50);

    // First standard path returns sitemap index, child-1 works, child-2 times out
    axios.get.mockImplementation(async (url) => {
      if (url.includes('sitemap_index.xml')) {
        return { data: indexXml };
      }
      if (url.includes('child-1.xml')) {
        return { data: childUrlsetXml };
      }
      if (url.includes('child-2.xml')) {
        throw new Error('Connection timeout');
      }
      throw new Error('404');
    });

    parseSitemapXml.mockImplementation((xml) => {
      if (xml.includes('<sitemapindex')) {
        return {
          type: 'index',
          entries: ['https://example.com/child-1.xml', 'https://example.com/child-2.xml'],
        };
      }
      if (xml.includes('<urlset')) {
        return { type: 'urlset', entries: ['https://example.com/page1'] };
      }
      return { type: 'unknown', entries: [] };
    });

    fetchViaScrapeOwl.mockRejectedValue(new Error('No API key'));

    const result = await crawlDomain('example.com');
    expect(result.source).toBe('sitemap');
    expect(result.urls).toContain('https://example.com/page1');

    // Discovery should report the failure
    expect(result.discovery).toBeDefined();
    expect(result.discovery.warnings.length).toBeGreaterThan(0);
    expect(result.discovery.warnings[0]).toContain('1 of 2 child sitemaps');

    // The successful sitemap entry should have children metadata
    const indexEntry = result.discovery.sitemapsAttempted.find(s => s.type === 'index');
    expect(indexEntry).toBeDefined();
    expect(indexEntry.children).toHaveLength(2);

    const successChild = indexEntry.children.find(c => c.url.includes('child-1'));
    expect(successChild.status).toBe('success');
    expect(successChild.urlCount).toBe(1);

    const failedChild = indexEntry.children.find(c => c.url.includes('child-2'));
    expect(failedChild.status).toBe('failed');
    expect(failedChild.error).toBeTruthy(); // has some error message (could be timeout or ScrapeOWL fallback)
  });

  test('tries expanded sitemap paths (wp-sitemap.xml, etc.)', async () => {
    // All sitemap paths fail except wp-sitemap.xml
    axios.get.mockImplementation(async (url) => {
      if (url.includes('wp-sitemap.xml')) {
        return { data: validSitemapXml };
      }
      throw new Error('404');
    });

    parseSitemapXml.mockReturnValue({
      type: 'urlset',
      entries: ['https://example.com/wp-page'],
    });

    fetchViaScrapeOwl.mockRejectedValue(new Error('No API key'));

    const result = await crawlDomain('example.com');
    expect(result.source).toBe('sitemap');
    expect(result.urls).toContain('https://example.com/wp-page');

    // Discovery should show the failed attempts before the successful one
    // wp-sitemap.xml is the 3rd suffix: sitemap_index, sitemap, wp-sitemap
    const successIdx = result.discovery.sitemapsAttempted.findIndex(s => s.status === 'success');
    expect(successIdx).toBeGreaterThanOrEqual(2); // at least 2 failures before it
    // All entries before the successful one should have failed
    for (let i = 0; i < successIdx; i++) {
      expect(result.discovery.sitemapsAttempted[i].status).not.toBe('success');
    }
    expect(result.discovery.sitemapsAttempted[successIdx].status).toBe('success');
  });

  test('deep crawl discovers links across multiple pages', async () => {
    // ScrapeOWL always fails
    fetchViaScrapeOwl.mockRejectedValue(new Error('No API key'));

    // Padding to ensure pages pass length checks (> 500 for homepage, > 200 for sub-pages)
    const pad = '<p>' + 'Lorem ipsum dolor sit amet. '.repeat(30) + '</p>';

    // Multi-level site: homepage → about, blog → blog/post1, blog/post2
    axios.get.mockImplementation(async (url) => {
      if (url === 'https://example.com') {
        return {
          data: '<html><body>' + pad +
            '<a href="/about">About</a>' +
            '<a href="/blog">Blog</a>' +
            '</body></html>',
        };
      }
      if (url === 'https://example.com/about') {
        return {
          data: '<html><body>' + pad +
            '<a href="/team">Team</a>' +
            '</body></html>',
        };
      }
      if (url === 'https://example.com/blog') {
        return {
          data: '<html><body>' + pad +
            '<a href="/blog/post1">Post 1</a>' +
            '<a href="/blog/post2">Post 2</a>' +
            '</body></html>',
        };
      }
      if (url.includes('/blog/post') || url.includes('/team')) {
        return {
          data: '<html><body>' + pad + '<p>Leaf page</p></body></html>',
        };
      }
      // robots.txt returns nothing useful
      if (url.includes('robots.txt')) {
        return { data: '# empty' };
      }
      // All sitemap paths fail
      throw new Error('404');
    });

    const result = await crawlDomain('example.com');
    expect(result.source).toBe('deep-crawl');

    // All pages should be discovered
    expect(result.urls).toContain('https://example.com');
    expect(result.urls).toContain('https://example.com/about');
    expect(result.urls).toContain('https://example.com/blog');
    expect(result.urls).toContain('https://example.com/team');
    expect(result.urls).toContain('https://example.com/blog/post1');
    expect(result.urls).toContain('https://example.com/blog/post2');

    // Deep crawl metadata
    expect(result.discovery.deepCrawl).toBeDefined();
    expect(result.discovery.deepCrawl.totalDiscovered).toBeGreaterThanOrEqual(6);
  }, 30000);
});
