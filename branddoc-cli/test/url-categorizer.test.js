const { categorizeUrls, categorizeUrl } = require('../src/lib/url-categorizer');

describe('categorizeUrls', () => {
  test('categorizes homepage as "Homepage"', () => {
    const result = categorizeUrls(['https://example.com/']);
    expect(result).toEqual([
      { url: 'https://example.com/', language: null, pageType: 'Homepage' },
    ]);
  });

  test('detects language from URL path', () => {
    const result = categorizeUrls([
      'https://example.com/fr/about',
      'https://example.com/fr/contact',
    ]);
    expect(result[0].language).toBe('fr');
    expect(result[1].language).toBe('fr');
  });

  test('groups URLs by first slug when 2+ share it', () => {
    const result = categorizeUrls([
      'https://example.com/blog/post-1',
      'https://example.com/blog/post-2',
      'https://example.com/about',
    ]);
    expect(result[0].pageType).toBe('blog');
    expect(result[1].pageType).toBe('blog');
    // 'about' only has 1 URL so it becomes "Other"
    expect(result[2].pageType).toBe('Other');
  });

  test('assigns "Other" to unique slugs', () => {
    const result = categorizeUrls([
      'https://example.com/unique-page',
      'https://example.com/another-unique',
    ]);
    expect(result[0].pageType).toBe('Other');
    expect(result[1].pageType).toBe('Other');
  });

  test('handles empty array', () => {
    expect(categorizeUrls([])).toEqual([]);
  });

  test('skips language segment for slug grouping', () => {
    const result = categorizeUrls([
      'https://example.com/en/products/shoes',
      'https://example.com/en/products/hats',
      'https://example.com/fr/products/chaussures',
    ]);
    // All three share "products" as first meaningful slug
    expect(result[0].pageType).toBe('products');
    expect(result[1].pageType).toBe('products');
    expect(result[2].pageType).toBe('products');
  });

  test('handles invalid URLs gracefully', () => {
    const result = categorizeUrls(['not-a-url', 'https://example.com/']);
    // Should not throw; invalid URL gets default categorization
    expect(result).toHaveLength(2);
    expect(result[1].pageType).toBe('Homepage');
  });
});

describe('categorizeUrl (single URL)', () => {
  test('categorizes a single URL with language', () => {
    const result = categorizeUrl('https://example.com/fr/about');
    expect(result.language).toBe('fr');
    expect(result.url).toBe('https://example.com/fr/about');
  });

  test('categorizes homepage', () => {
    const result = categorizeUrl('https://example.com/');
    expect(result.pageType).toBe('Homepage');
    expect(result.language).toBeNull();
  });

  test('returns "Other" for single URL with unique slug', () => {
    const result = categorizeUrl('https://example.com/about');
    expect(result.pageType).toBe('Other');
  });
});
