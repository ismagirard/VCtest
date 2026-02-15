const axios = require('axios');
const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const { fetchViaScrapeOwl } = require('./scrapeowl-client');
const { fetchWithBrowser } = require('./browser-fetcher');
const { SCRAPEOWL_API_KEY } = require('../config');

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

const REMOVE_SELECTORS = [
  'script', 'style', 'noscript', 'iframe',
  'nav', 'footer', 'header', 'aside',
  '[role="banner"]', '[role="navigation"]', '[role="contentinfo"]',
  '.cookie-banner', '.cookie-notice', '#cookie-consent',
  '.ad', '.ads', '.advertisement', '#ads',
  '.popup', '.modal', '.overlay',
  '.sidebar', '.widget',
];

const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Max time for the entire 4-tier fetch pipeline per URL
const FETCH_TIMEOUT = 60_000; // 60 seconds
// Max time for JSDOM + Readability parsing (synchronous, can block event loop)
const PARSE_TIMEOUT = 10_000; // 10 seconds

/**
 * Check if HTML looks like a real page (not an anti-bot challenge or error page).
 * Returns false for Vercel Security Checkpoint, Cloudflare challenges, etc.
 */
function isRealContent(html, status) {
  if (status && status >= 400) return false;
  if (typeof html !== 'string' || html.length < 500) return false;

  const lower = html.toLowerCase();
  // Known anti-bot / challenge page signatures
  if (lower.includes('vercel security checkpoint')) return false;
  if (lower.includes('cf-challenge-running')) return false;
  if (lower.includes('cloudflare') && lower.includes('challenge')) return false;
  if (lower.includes('attention required') && lower.includes('cloudflare')) return false;
  if (lower.includes('just a moment') && lower.includes('enable javascript')) return false;
  if (lower.includes('ddos-guard')) return false;

  return true;
}

/**
 * Check if Puppeteer-rendered HTML is a soft 404 ("page not found" rendered by the SPA).
 */
function isSoft404(html) {
  if (typeof html !== 'string') return true;
  // Strip scripts/styles and check text content
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length < 150) return true;

  const lower = text.toLowerCase();
  if (lower.includes('page introuvable') || lower.includes('page not found') || lower.includes('404')) {
    // Only if the page is very short (real 404 pages are short)
    if (text.length < 500) return true;
  }

  return false;
}

async function _fetchHtmlTiers(url) {
  // Try 1: Direct fetch with normal browser UA (fast, free)
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxRedirects: 5,
      validateStatus: () => true,
    });
    if (isRealContent(response.data, response.status)) {
      return response.data;
    }
  } catch (err) {
    // Direct fetch failed — try Googlebot UA
  }

  // Try 2: Direct fetch with Googlebot UA (works on many tough sites)
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': GOOGLEBOT_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxRedirects: 5,
      validateStatus: () => true,
    });
    if (isRealContent(response.data, response.status)) {
      return response.data;
    }
    // Don't throw on 404 — the page might need JS rendering (Puppeteer will try next)
  } catch (err) {
    // Fall through to Puppeteer
  }

  // Try 3: Headless browser with stealth (handles JS-rendered + bot-protected pages)
  try {
    const html = await fetchWithBrowser(url, { waitForSelector: 'main', timeout: 30000 });
    // Check for soft 404 (SPA renders "page not found" with JS)
    if (isSoft404(html)) {
      throw new Error('Page not found (soft 404)');
    }
    if (html && html.length > 500) {
      return html;
    }
  } catch (err) {
    // Re-throw soft 404 — no point trying ScrapeOWL
    if (err.message.includes('Page not found')) throw err;
    console.warn(`  Puppeteer failed for ${url}: ${err.message}`);
  }

  // Try 4: ScrapeOWL as last resort
  if (SCRAPEOWL_API_KEY) {
    return await fetchViaScrapeOwl(url);
  }

  throw new Error('All fetch methods failed');
}

/**
 * Fetch HTML with a hard 60s ceiling across all tiers.
 * Prevents a single URL from blocking a worker for 2-3 minutes.
 */
async function fetchHtml(url) {
  let timer;
  const timeoutP = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Fetch timed out after ${FETCH_TIMEOUT / 1000}s`)), FETCH_TIMEOUT);
  });
  const actual = _fetchHtmlTiers(url);
  actual.catch(() => {}); // prevent unhandled rejection if timeout wins the race
  try {
    return await Promise.race([actual, timeoutP]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run JSDOM + Readability with a timeout so a massive DOM doesn't block the event loop.
 * Falls back to simple Cheerio extraction if it takes too long.
 */
function parseWithReadability(cleanedHtml, url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Readability parse timed out')), PARSE_TIMEOUT);
    try {
      const dom = new JSDOM(cleanedHtml, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      clearTimeout(timer);
      resolve(article);
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

async function extractContent(url) {
  try {
    const html = await fetchHtml(url);

    // Pre-clean with Cheerio
    const $ = cheerio.load(html);
    REMOVE_SELECTORS.forEach((sel) => $(sel).remove());
    const cleanedHtml = $.html();

    // Extract with Readability (timeout-protected)
    let article = null;
    try {
      article = await parseWithReadability(cleanedHtml, url);
    } catch (parseErr) {
      console.warn(`  Readability failed for ${url}: ${parseErr.message}, using Cheerio fallback`);
    }

    if (article && article.content) {
      const markdown = turndown.turndown(article.content);
      return {
        url,
        title: article.title || url,
        markdown,
        error: null,
      };
    }

    // Fallback: grab text from body paragraphs and headings
    const fallbackHtml = $('main, article, body').first().html() || '';
    const fallbackMd = turndown.turndown(fallbackHtml);
    return {
      url,
      title: $('title').text() || url,
      markdown: fallbackMd || '(No extractable content)',
      error: null,
    };
  } catch (err) {
    return {
      url,
      title: null,
      markdown: null,
      error: err.message,
    };
  }
}

module.exports = { extractContent, isRealContent, isSoft404 };
