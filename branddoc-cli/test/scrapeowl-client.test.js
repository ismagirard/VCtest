// Tests for scrapeowl-client.js
// All tests mock axios to avoid real API calls.

jest.mock('axios');
jest.mock('../src/config', () => ({
  SCRAPEOWL_API_KEY: 'test-owl-key-123',
}));

const axios = require('axios');
const { fetchViaScrapeOwl } = require('../src/lib/scrapeowl-client');

beforeEach(() => {
  axios.get.mockReset();
});

describe('fetchViaScrapeOwl', () => {
  test('returns HTML from successful basic response', async () => {
    axios.get.mockResolvedValue({
      data: {
        html: '<html><body>Scraped content</body></html>',
        status: 200,
        credits: { used: 1, remaining: 999 },
      },
    });

    const html = await fetchViaScrapeOwl('https://example.com/');
    expect(html).toBe('<html><body>Scraped content</body></html>');
    // Should use basic params (no premium)
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.scrapeowl.com/v1/scrape',
      expect.objectContaining({
        params: expect.objectContaining({
          api_key: 'test-owl-key-123',
          url: 'https://example.com/',
          json_response: true,
        }),
      })
    );
    // Basic attempt should NOT include premium_proxies
    const params = axios.get.mock.calls[0][1].params;
    expect(params.premium_proxies).toBeUndefined();
  });

  test('escalates to premium on basic failure (403)', async () => {
    // Basic attempt: 403
    axios.get.mockRejectedValueOnce({
      response: { status: 403 },
      message: 'Forbidden',
    });
    // Premium attempt: success
    axios.get.mockResolvedValueOnce({
      data: {
        html: '<html><body>Premium content</body></html>',
        status: 200,
      },
    });

    const html = await fetchViaScrapeOwl('https://tough-site.com/');
    expect(html).toBe('<html><body>Premium content</body></html>');
    expect(axios.get).toHaveBeenCalledTimes(2);
    // Second call should have premium params
    const premiumParams = axios.get.mock.calls[1][1].params;
    expect(premiumParams.premium_proxies).toBe(true);
    expect(premiumParams.render_js).toBe(true);
  });

  test('goes straight to premium when premiumFirst=true', async () => {
    axios.get.mockResolvedValue({
      data: { html: '<html>Premium</html>', status: 200 },
    });

    await fetchViaScrapeOwl('https://example.com/', { premiumFirst: true });
    expect(axios.get).toHaveBeenCalledTimes(1);
    const params = axios.get.mock.calls[0][1].params;
    expect(params.premium_proxies).toBe(true);
    expect(params.render_js).toBe(true);
  });

  test('throws when target returns HTTP 4xx', async () => {
    axios.get.mockResolvedValue({
      data: { html: '', status: 404, credits: { used: 1 } },
    });

    await expect(fetchViaScrapeOwl('https://example.com/missing'))
      .rejects.toThrow('Target returned HTTP 404');
  });

  test('throws when all attempts fail', async () => {
    axios.get.mockRejectedValue(new Error('Connection refused'));

    await expect(fetchViaScrapeOwl('https://down.example.com/'))
      .rejects.toThrow('Connection refused');
  });

  test('throws when response has no HTML', async () => {
    axios.get.mockResolvedValue({
      data: { status: 200 },  // no html field
    });

    await expect(fetchViaScrapeOwl('https://example.com/'))
      .rejects.toThrow('Empty response from ScrapeOWL');
  });

  test('handles string response as fallback', async () => {
    axios.get.mockResolvedValue({
      data: '<html>Raw string response</html>',
    });

    const html = await fetchViaScrapeOwl('https://example.com/');
    expect(html).toBe('<html>Raw string response</html>');
  });
});

describe('fetchViaScrapeOwl — no API key', () => {
  let noKeyFn;

  beforeAll(() => {
    jest.resetModules();
    jest.mock('../src/config', () => ({ SCRAPEOWL_API_KEY: '' }));
    jest.mock('axios');
    noKeyFn = require('../src/lib/scrapeowl-client').fetchViaScrapeOwl;
  });

  test('throws when SCRAPEOWL_API_KEY is not set', async () => {
    await expect(noKeyFn('https://example.com/'))
      .rejects.toThrow('SCRAPEOWL_API_KEY is not set');
  });
});
