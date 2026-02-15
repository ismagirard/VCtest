// Tests for sitemap-parser.js
// parseSitemapXml is pure (no I/O) — tested with fixture XML strings.
// parseSitemap is async (axios) — tested with mocked HTTP responses.

jest.mock('axios');
const axios = require('axios');
const { parseSitemapXml, parseSitemap } = require('../src/lib/sitemap-parser');

beforeEach(() => {
  axios.get.mockReset();
});

// ─── parseSitemapXml (pure) ──────────────────────────────────────────
describe('parseSitemapXml', () => {
  test('parses urlset with multiple URLs', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/</loc></url>
        <url><loc>https://example.com/about</loc></url>
        <url><loc>https://example.com/contact</loc></url>
      </urlset>`;
    const result = parseSitemapXml(xml);
    expect(result.type).toBe('urlset');
    expect(result.entries).toHaveLength(3);
    expect(result.entries).toContain('https://example.com/about');
  });

  test('parses sitemap index', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap>
        <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
      </sitemapindex>`;
    const result = parseSitemapXml(xml);
    expect(result.type).toBe('index');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toBe('https://example.com/sitemap-posts.xml');
  });

  test('returns unknown for non-sitemap XML', () => {
    const xml = `<?xml version="1.0"?><root><item>hello</item></root>`;
    const result = parseSitemapXml(xml);
    expect(result.type).toBe('unknown');
    expect(result.entries).toEqual([]);
  });

  test('handles urlset with single URL (not array)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/only-one</loc></url>
      </urlset>`;
    const result = parseSitemapXml(xml);
    expect(result.type).toBe('urlset');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toBe('https://example.com/only-one');
  });

  test('handles urlset with extra fields (lastmod, changefreq)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/page</loc>
          <lastmod>2024-01-01</lastmod>
          <changefreq>weekly</changefreq>
        </url>
      </urlset>`;
    const result = parseSitemapXml(xml);
    expect(result.type).toBe('urlset');
    expect(result.entries[0]).toBe('https://example.com/page');
  });
});

// ─── parseSitemap (async, mocked) ───────────────────────────────────
describe('parseSitemap', () => {
  test('parses a simple urlset sitemap', async () => {
    axios.get.mockResolvedValue({
      data: `<?xml version="1.0"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/</loc></url>
          <url><loc>https://example.com/blog</loc></url>
        </urlset>`,
    });

    const urls = await parseSitemap('https://example.com/sitemap.xml');
    expect(urls).toHaveLength(2);
    expect(urls).toContain('https://example.com/blog');
  });

  test('recurses into sitemap index', async () => {
    // First call: sitemap index
    axios.get.mockResolvedValueOnce({
      data: `<?xml version="1.0"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
        </sitemapindex>`,
    });
    // Second call: child urlset
    axios.get.mockResolvedValueOnce({
      data: `<?xml version="1.0"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page-a</loc></url>
          <url><loc>https://example.com/page-b</loc></url>
        </urlset>`,
    });

    const urls = await parseSitemap('https://example.com/sitemap.xml');
    expect(urls).toHaveLength(2);
    expect(urls).toContain('https://example.com/page-a');
  });

  test('respects maxDepth to prevent infinite recursion', async () => {
    // Every call returns another sitemap index (infinite loop)
    axios.get.mockResolvedValue({
      data: `<?xml version="1.0"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://example.com/infinite.xml</loc></sitemap>
        </sitemapindex>`,
    });

    const urls = await parseSitemap('https://example.com/sitemap.xml', { maxDepth: 2 });
    // Should terminate without hanging — depth limit stops recursion
    expect(Array.isArray(urls)).toBe(true);
  });

  test('returns empty array on HTTP error', async () => {
    axios.get.mockRejectedValue(new Error('404 Not Found'));
    const urls = await parseSitemap('https://example.com/sitemap.xml');
    expect(urls).toEqual([]);
  });

  test('deduplicates URLs across child sitemaps', async () => {
    axios.get.mockResolvedValueOnce({
      data: `<?xml version="1.0"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://example.com/sm-1.xml</loc></sitemap>
          <sitemap><loc>https://example.com/sm-2.xml</loc></sitemap>
        </sitemapindex>`,
    });
    // Both children contain the same URL
    const childXml = `<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/shared-page</loc></url>
      </urlset>`;
    axios.get.mockResolvedValueOnce({ data: childXml });
    axios.get.mockResolvedValueOnce({ data: childXml });

    const urls = await parseSitemap('https://example.com/sitemap.xml');
    expect(urls).toEqual(['https://example.com/shared-page']);
  });
});
