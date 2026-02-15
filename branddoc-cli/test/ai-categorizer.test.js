// Mock axios and config before requiring the module
jest.mock('axios');
jest.mock('../src/config', () => ({
  ANTHROPIC_API_KEY: 'test-key-123',
}));

const axios = require('axios');
const { aiCategorizeUrls } = require('../src/lib/ai-categorizer');

beforeEach(() => {
  axios.post.mockReset();
});

describe('aiCategorizeUrls', () => {
  test('returns AI-categorized URLs on success', async () => {
    axios.post.mockResolvedValue({
      data: {
        content: [{
          text: JSON.stringify([
            { path: '/', pageType: 'Homepage' },
            { path: '/about', pageType: 'About' },
            { path: '/blog/post-1', pageType: 'Blog' },
          ]),
        }],
      },
    });

    const result = await aiCategorizeUrls([
      'https://example.com/',
      'https://example.com/about',
      'https://example.com/blog/post-1',
    ]);

    expect(result).toHaveLength(3);
    expect(result[0].pageType).toBe('Homepage');
    expect(result[1].pageType).toBe('About');
    expect(result[2].pageType).toBe('Blog');
  });

  test('preserves language detection from regex categorizer', async () => {
    axios.post.mockResolvedValue({
      data: {
        content: [{
          text: JSON.stringify([
            { path: '/fr/about', pageType: 'About' },
          ]),
        }],
      },
    });

    const result = await aiCategorizeUrls(['https://example.com/fr/about']);
    expect(result[0].language).toBe('fr');
    expect(result[0].pageType).toBe('About');
  });

  test('falls back to "Other" for unmatched paths', async () => {
    axios.post.mockResolvedValue({
      data: {
        content: [{
          text: JSON.stringify([
            { path: '/', pageType: 'Homepage' },
            // Intentionally missing /contact
          ]),
        }],
      },
    });

    const result = await aiCategorizeUrls([
      'https://example.com/',
      'https://example.com/contact',
    ]);

    expect(result[0].pageType).toBe('Homepage');
    expect(result[1].pageType).toBe('Other');
  });

  test('handles markdown-fenced JSON response', async () => {
    axios.post.mockResolvedValue({
      data: {
        content: [{
          text: '```json\n[{"path":"/","pageType":"Homepage"}]\n```',
        }],
      },
    });

    const result = await aiCategorizeUrls(['https://example.com/']);
    expect(result[0].pageType).toBe('Homepage');
  });

  test('returns null on API error (signals fallback to regex)', async () => {
    axios.post.mockRejectedValue(new Error('Network error'));
    const result = await aiCategorizeUrls(['https://example.com/']);
    expect(result).toBeNull();
  });

  test('returns null on malformed JSON response', async () => {
    axios.post.mockResolvedValue({
      data: { content: [{ text: 'not valid json at all' }] },
    });
    const result = await aiCategorizeUrls(['https://example.com/']);
    expect(result).toBeNull();
  });
});

describe('aiCategorizeUrls — no API key', () => {
  let freshFn;

  beforeAll(() => {
    // Fresh module graph with empty API key — isolated from tests above
    jest.resetModules();
    jest.mock('../src/config', () => ({ ANTHROPIC_API_KEY: '' }));
    jest.mock('axios');
    freshFn = require('../src/lib/ai-categorizer').aiCategorizeUrls;
  });

  test('returns null when ANTHROPIC_API_KEY is empty', async () => {
    const result = await freshFn(['https://example.com/']);
    expect(result).toBeNull();
  });

  test('does not call Anthropic API when key is empty', async () => {
    const freshAxios = require('axios');
    await freshFn(['https://example.com/']);
    expect(freshAxios.post).not.toHaveBeenCalled();
  });
});
