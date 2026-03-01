/**
 * Browser-based HTML fetcher using Puppeteer + stealth plugin.
 * Used as a fallback when direct HTTP requests and ScrapeOWL fail.
 * Runs a real headless Chromium that passes bot detection.
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

let browserInstance = null;
let browserPageCount = 0;
const MAX_PAGES_BEFORE_RESTART = 30;

/**
 * Promise that rejects after `ms` milliseconds.
 */
function timeoutPromise(ms, label = 'Operation') {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
}

/**
 * Get or create a shared browser instance.
 * Wrapped in error handling so a failed launch doesn't leave stale state.
 */
async function getBrowser() {
  if (browserInstance) {
    try {
      if (browserInstance.isConnected() && browserPageCount < MAX_PAGES_BEFORE_RESTART) {
        return browserInstance;
      }
    } catch (e) {
      // isConnected() threw — browser is dead
    }
  }

  // Close old instance if it exists
  if (browserInstance) {
    try { await browserInstance.close(); } catch (e) {}
    browserInstance = null;
    browserPageCount = 0;
  }

  try {
    browserInstance = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,720',
      ],
      defaultViewport: { width: 1280, height: 720 },
    });

    browserInstance.on('disconnected', () => {
      browserInstance = null;
      browserPageCount = 0;
    });

    return browserInstance;
  } catch (err) {
    // Launch failed — ensure state is clean
    browserInstance = null;
    browserPageCount = 0;
    throw err;
  }
}

/**
 * Fetch a page's fully-rendered HTML using a stealth headless browser.
 * Wrapped in a safety timeout to prevent indefinite hangs.
 */
async function fetchWithBrowser(url, options = {}) {
  const { timeout = 30000, waitForSelector = 'body' } = options;
  // Safety ceiling: the entire operation must complete within timeout + 15s buffer
  const safetyTimeout = timeout + 15000;

  let timer;
  const timeoutP = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`fetchWithBrowser(${url}) timed out after ${safetyTimeout}ms`)), safetyTimeout);
  });

  const actual = _doFetch(url, { timeout, waitForSelector });
  actual.catch(() => {}); // prevent unhandled rejection if timeout wins the race
  try {
    return await Promise.race([actual, timeoutP]);
  } finally {
    clearTimeout(timer);
  }
}

async function _doFetch(url, { timeout, waitForSelector }) {
  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    browserPageCount++;

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
    });

    // Block images/fonts/media to save memory and speed up rendering
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout,
    });

    try {
      await page.waitForSelector(waitForSelector, { timeout: 8000 });
    } catch (e) {
      // Selector not found, continue with whatever rendered
    }

    // Quick check for soft 404 before waiting longer
    const quickText = await page.evaluate(() => document.body ? document.body.innerText.trim() : '');
    const isQuick404 = quickText.length < 200 && (
      quickText.toLowerCase().includes('introuvable') ||
      quickText.toLowerCase().includes('not found') ||
      quickText.toLowerCase().includes('404')
    );

    if (!isQuick404) {
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
    }

    const html = await page.content();
    return html;
  } finally {
    if (page) {
      try { await page.close(); } catch (e) {}
      browserPageCount = Math.max(0, browserPageCount - 1);
    }
  }
}

/**
 * Close the shared browser instance.
 * Times out after 5s to prevent hanging on stuck browser processes.
 */
async function closeBrowser() {
  if (browserInstance) {
    const instance = browserInstance;
    browserInstance = null;
    browserPageCount = 0;
    try {
      await Promise.race([
        instance.close(),
        timeoutPromise(5000, 'closeBrowser'),
      ]);
    } catch (e) {
      // Browser close timed out or errored — it's gone either way
    }
  }
}

module.exports = { fetchWithBrowser, closeBrowser };
