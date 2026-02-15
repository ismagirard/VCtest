const axios = require('axios');
const { fetchViaScrapeOwl } = require('./scrapeowl-client');
const { parseSitemapXml } = require('./sitemap-parser');
const cheerio = require('cheerio');

const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function normalizeDomain(input) {
  let domain = input.trim().replace(/\/+$/, '');
  if (!domain.startsWith('http')) {
    domain = 'https://' + domain;
  }
  return domain;
}

function looksLikeXml(str) {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  return trimmed.startsWith('<?xml')
    || trimmed.startsWith('<urlset')
    || trimmed.startsWith('<sitemapindex');
}

/**
 * Direct fetch with Googlebot user agent.
 * Many sites that block regular crawlers still allow Googlebot.
 * This is free and fast — tried before ScrapeOWL.
 */
async function fetchWithGooglebot(url, timeout = 15000) {
  const response = await axios.get(url, {
    timeout,
    headers: {
      'User-Agent': GOOGLEBOT_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    maxRedirects: 5,
  });
  if (typeof response.data === 'string') return response.data;
  // axios may auto-parse XML as object for some content types
  if (typeof response.data === 'object') return JSON.stringify(response.data);
  return String(response.data);
}

/**
 * Fetch a URL using multiple strategies in order:
 * 1. Googlebot UA direct fetch (free, fast, works on many tough sites)
 * 2. ScrapeOWL (handles anti-bot protection with proxy tiers)
 */
async function fetchWithFallback(url) {
  // Strategy A: Googlebot UA
  try {
    const data = await fetchWithGooglebot(url);
    if (data && data.length > 100) {
      return data;
    }
  } catch (err) {
    console.warn(`  Googlebot fetch failed for ${url}: ${err.message}`);
  }

  // Strategy B: ScrapeOWL
  return await fetchViaScrapeOwl(url);
}

async function tryParseSitemap(url) {
  try {
    const xml = await fetchWithFallback(url);
    if (!looksLikeXml(xml)) return null;

    const result = parseSitemapXml(xml);

    if (result.type === 'urlset' && result.entries.length > 0) {
      return [...new Set(result.entries)];
    }

    if (result.type === 'index') {
      console.log(`  Sitemap index with ${result.entries.length} child sitemaps — fetching in parallel...`);
      const childResults = await Promise.allSettled(
        result.entries.map(async (childUrl) => {
          try {
            const childXml = await fetchWithFallback(childUrl);
            if (looksLikeXml(childXml)) {
              const childResult = parseSitemapXml(childXml);
              if (childResult.type === 'urlset') {
                return childResult.entries;
              }
            }
          } catch (err) {
            console.warn(`  Failed to fetch child sitemap ${childUrl}: ${err.message}`);
          }
          return [];
        })
      );
      const allUrls = childResults
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);
      if (allUrls.length > 0) {
        return [...new Set(allUrls)];
      }
    }
  } catch (err) {
    console.warn(`  Sitemap fetch failed for ${url}: ${err.message}`);
  }
  return null;
}

/**
 * Fetch robots.txt using multiple strategies.
 * Returns the text content or null.
 */
async function fetchRobotsTxt(baseUrl) {
  const robotsUrl = baseUrl + '/robots.txt';

  // Try Googlebot UA first (works on many tough sites)
  try {
    const data = await fetchWithGooglebot(robotsUrl);
    if (typeof data === 'string' && data.includes('User-Agent')) {
      return data;
    }
  } catch (err) {
    console.warn(`  Googlebot robots.txt fetch failed: ${err.message}`);
  }

  // Fallback to ScrapeOWL
  try {
    const data = await fetchViaScrapeOwl(robotsUrl);
    if (typeof data === 'string' && data.includes('User-Agent')) {
      return data;
    }
  } catch (err) {
    console.warn(`  ScrapeOWL robots.txt fetch failed: ${err.message}`);
  }

  return null;
}

async function crawlDomain(domainInput) {
  const baseUrl = normalizeDomain(domainInput);
  const hostname = new URL(baseUrl).hostname;

  // Strategy 1: Try sitemap paths directly (using Googlebot + ScrapeOWL fallback)
  const sitemapPaths = ['/sitemap_index.xml', '/sitemap.xml'];
  for (const spath of sitemapPaths) {
    console.log(`  Trying ${baseUrl}${spath}`);
    const urls = await tryParseSitemap(baseUrl + spath);
    if (urls && urls.length > 0) {
      return { urls, source: 'sitemap' };
    }
  }

  // Strategy 2: Check robots.txt for Sitemap directives
  // This handles cross-hostname sitemaps (e.g., robots.txt on domain A
  // points to sitemap on domain B)
  const robotsTxt = await fetchRobotsTxt(baseUrl);
  if (robotsTxt && robotsTxt.includes('Sitemap:')) {
    const sitemapUrls = robotsTxt
      .split('\n')
      .filter((line) => /^Sitemap:/i.test(line.trim()))
      .map((line) => line.replace(/^Sitemap:\s*/i, '').trim())
      .filter(Boolean);

    console.log(`  Found ${sitemapUrls.length} sitemap(s) in robots.txt — fetching in parallel...`);
    sitemapUrls.forEach(u => console.log(`    ${u}`));
    const smResults = await Promise.allSettled(
      sitemapUrls.map(smUrl => tryParseSitemap(smUrl))
    );
    const allUrls = smResults
      .filter(r => r.status === 'fulfilled' && r.value && r.value.length > 0)
      .flatMap(r => r.value);
    if (allUrls.length > 0) {
      return { urls: [...new Set(allUrls)], source: 'sitemap' };
    }
  }

  // Strategy 3: Deep crawl — scrape homepage for internal links
  // Try Googlebot UA first, then premium ScrapeOWL
  console.log('  No sitemap found, falling back to homepage link extraction');
  let html = null;

  // Try Googlebot UA
  try {
    html = await fetchWithGooglebot(baseUrl, 20000);
    if (!html || html.length < 500) html = null;
  } catch (err) {
    console.warn(`  Googlebot homepage fetch failed: ${err.message}`);
  }

  // Fallback to ScrapeOWL premium
  if (!html) {
    try {
      html = await fetchViaScrapeOwl(baseUrl, { premiumFirst: true });
    } catch (err) {
      throw new Error(`Failed to crawl domain: ${err.message}`);
    }
  }

  const $ = cheerio.load(html);
  const urls = new Set();
  urls.add(baseUrl);

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname === hostname && resolved.protocol.startsWith('http')) {
        resolved.hash = '';
        resolved.search = '';
        const clean = resolved.href.replace(/\/+$/, '') || resolved.origin;
        urls.add(clean);
      }
    } catch {}
  });

  // Also look for links in nav, footer, and sitemap-like link collections
  $('[class*="nav"] a[href], [class*="menu"] a[href], footer a[href], [class*="sitemap"] a[href]').each((_, el) => {
    const href = $(el).attr('href');
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname === hostname && resolved.protocol.startsWith('http')) {
        resolved.hash = '';
        resolved.search = '';
        const clean = resolved.href.replace(/\/+$/, '') || resolved.origin;
        urls.add(clean);
      }
    } catch {}
  });

  return { urls: [...urls], source: 'homepage-links' };
}

module.exports = { crawlDomain, normalizeDomain, looksLikeXml };
