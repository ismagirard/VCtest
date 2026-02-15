// Test browser-fetcher lifecycle management without launching a real browser.
// We mock puppeteer-extra to avoid requiring Chromium.

const mockPage = {
  setUserAgent: jest.fn(),
  setExtraHTTPHeaders: jest.fn(),
  setRequestInterception: jest.fn(),
  on: jest.fn(),
  goto: jest.fn().mockResolvedValue(),
  waitForSelector: jest.fn().mockResolvedValue(),
  evaluate: jest.fn().mockResolvedValue('Real page content here that is long enough to pass checks'),
  content: jest.fn().mockResolvedValue('<html><body>Test content</body></html>'),
  close: jest.fn(),
};

const mockBrowser = {
  isConnected: jest.fn().mockReturnValue(true),
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn(),
  on: jest.fn(),
};

jest.mock('puppeteer-extra', () => {
  const mock = {
    use: jest.fn(),
    launch: jest.fn().mockResolvedValue(mockBrowser),
  };
  return mock;
});

jest.mock('puppeteer-extra-plugin-stealth', () => {
  return jest.fn().mockReturnValue({});
});

const { fetchWithBrowser, closeBrowser } = require('../src/lib/browser-fetcher');

beforeEach(() => {
  jest.clearAllMocks();
  mockBrowser.isConnected.mockReturnValue(true);
});

afterEach(async () => {
  await closeBrowser();
});

describe('fetchWithBrowser', () => {
  test('returns page HTML on success', async () => {
    const html = await fetchWithBrowser('https://example.com/test');
    expect(html).toBe('<html><body>Test content</body></html>');
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/test', expect.any(Object));
  });

  test('sets user agent and headers', async () => {
    await fetchWithBrowser('https://example.com/test');
    expect(mockPage.setUserAgent).toHaveBeenCalled();
    expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith(
      expect.objectContaining({ 'Accept-Language': expect.any(String) })
    );
  });

  test('enables request interception to block images/fonts', async () => {
    await fetchWithBrowser('https://example.com/test');
    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
  });

  test('closes page after use even if goto throws', async () => {
    mockPage.goto.mockRejectedValueOnce(new Error('Navigation timeout'));
    await expect(fetchWithBrowser('https://bad.com/')).rejects.toThrow('Navigation timeout');
    expect(mockPage.close).toHaveBeenCalled();
  });

  test('skips extra wait when quick 404 detected', async () => {
    // First evaluate call returns short "not found" text (quick 404)
    mockPage.evaluate
      .mockResolvedValueOnce('Page not found')  // quickText check
      // No second evaluate call for the setTimeout since it's a quick 404
    ;

    await fetchWithBrowser('https://example.com/missing');
    // evaluate called exactly once for quickText — NOT a second time for the
    // 1s setTimeout delay, which is skipped when isQuick404 is true
    expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
  });
});

describe('closeBrowser', () => {
  test('closes browser instance', async () => {
    // Trigger browser creation
    await fetchWithBrowser('https://example.com/');
    await closeBrowser();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  test('handles repeated closeBrowser calls', async () => {
    await closeBrowser();
    await closeBrowser(); // Should not throw
  });
});
