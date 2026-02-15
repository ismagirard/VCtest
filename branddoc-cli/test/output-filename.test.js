const { deriveDocSlug } = require('../src/lib/output-filename');

describe('deriveDocSlug', () => {
  test('uses hostname when at least one valid URL is present', () => {
    const slug = deriveDocSlug({ urls: ['https://example.com/path'] });
    expect(slug).toBe('example-com');
  });

  test('falls back to custom-doc title when no valid URL is present', () => {
    const slug = deriveDocSlug({
      urls: [],
      customDocs: [{ title: 'Support FAQ' }],
    });
    expect(slug).toMatch(/^support-faq-/);
  });

  test('uses manual prefix when neither URL nor custom doc title exists', () => {
    const slug = deriveDocSlug({ urls: [], customDocs: [] });
    expect(slug).toMatch(/^manual-/);
  });
});
