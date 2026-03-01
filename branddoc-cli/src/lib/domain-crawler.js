const axios = require('axios');
const { fetchViaScrapeOwl } = require('./scrapeowl-client');
const { parseSitemapXml } = require('./sitemap-parser');
const cheerio = require('cheerio');

const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// Skip binary/asset extensions when crawling links
const SKIP_EXT = /\.(css|js|png|jpe?g|gif|svg|ico|bmp|tiff?|avif|heic|woff2?|ttf|eot|pdf|zip|gz|tar|rar|mp[34]|avi|mov|webp|webm|ogg|flv|swf|xml|json|rss|atom)(\?|$)/i;

// Max URLs to discover via deep crawl (safety limit)
const MAX_CRAWL_URLS = 5000;

// Max pages to actually fetch during deep crawl
const MAX_CRAWL_PAGES = 200;

// Delay between page fetches during deep crawl (ms)
const CRAWL_DELAY_MS = 250;

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
 * Build a list of accepted hostnames for a domain (www + non-www).
 */
function getAcceptedHosts(hostname) {
  const hosts = [hostname];
  if (hostname.startsWith('www.')) {
    hosts.push(hostname.substring(4));
  } else {
    hosts.push('www.' + hostname);
  }
  return hosts;
}

/**
 * Check if a URL's hostname is in the accepted list.
 */
function isAcceptedHost(url, acceptedHosts) {
  try {
    const host = new URL(url).hostname;
    return acceptedHosts.includes(host);
  } catch {
    return false;
  }
}

/**
 * Clean a URL: remove hash, remove trailing slash, normalize.
 */
function cleanUrl(href, baseUrl, acceptedHosts) {
  try {
    const resolved = new URL(href, baseUrl);
    if (!resolved.protocol.startsWith('http')) return null;
    if (!acceptedHosts.includes(resolved.hostname)) return null;
    if (SKIP_EXT.test(resolved.pathname)) return null;
    resolved.hash = '';
    // Keep search params — some sites use them for real pages
    const clean = resolved.href.replace(/\/+$/, '') || resolved.origin;
    return clean;
  } catch {
    return null;
  }
}

/**
 * Direct fetch with Googlebot user agent.
 * Many sites that block regular crawlers still allow Googlebot.
 * This is free and fast — tried before ScrapeOWL.
 */
async function fetchWithGooglebot(url, timeout = 15000) {
  const response = await axios.get(url, {
    timeout,
    responseEncoding: 'utf-8',
    headers: {
      'User-Agent': GOOGLEBOT_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
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

/**
 * Try to parse a sitemap URL and return structured metadata about what was found.
 * Returns an object describing the attempt: status, type, URL count, children (for indexes), errors.
 */
async function tryParseSitemapWithMeta(url) {
  const entry = {
    url,
    status: 'failed',
    type: null,
    urlCount: 0,
    error: null,
    children: null,
    _urls: [],   // internal — stripped before returning to client
  };

  try {
    const xml = await fetchWithFallback(url);
    if (!looksLikeXml(xml)) {
      entry.status = 'not-xml';
      return entry;
    }

    const result = parseSitemapXml(xml);

    if (result.type === 'urlset' && result.entries.length > 0) {
      entry.status = 'success';
      entry.type = 'urlset';
      entry._urls = [...new Set(result.entries)];
      entry.urlCount = entry._urls.length;
      return entry;
    }

    if (result.type === 'index') {
      entry.type = 'index';
      entry.children = [];
      console.log(`  Sitemap index with ${result.entries.length} child sitemaps — fetching in parallel...`);

      const childResults = await Promise.allSettled(
        result.entries.map(async (childUrl) => {
          const child = { url: childUrl, status: 'failed', urlCount: 0, error: null };
          try {
            const childXml = await fetchWithFallback(childUrl);
            if (looksLikeXml(childXml)) {
              const childResult = parseSitemapXml(childXml);
              if (childResult.type === 'urlset') {
                child.status = 'success';
                child.urlCount = childResult.entries.length;
                return { child, urls: childResult.entries };
              }
            }
            child.status = 'not-xml';
          } catch (err) {
            child.error = err.message;
            console.warn(`  Failed to fetch child sitemap ${childUrl}: ${err.message}`);
          }
          return { child, urls: [] };
        })
      );

      const allUrls = [];
      for (const r of childResults) {
        if (r.status === 'fulfilled') {
          entry.children.push(r.value.child);
          allUrls.push(...r.value.urls);
        }
      }

      if (allUrls.length > 0) {
        entry.status = 'success';
        entry._urls = [...new Set(allUrls)];
        entry.urlCount = entry._urls.length;
      } else {
        entry.status = 'empty';
      }

      return entry;
    }

    entry.status = 'empty';
  } catch (err) {
    entry.error = err.message;
    console.warn(`  Sitemap fetch failed for ${url}: ${err.message}`);
  }

  return entry;
}

/**
 * Build human-readable warnings from discovery data.
 */
function buildWarnings(discovery) {
  for (const sm of discovery.sitemapsAttempted) {
    if (sm.children) {
      const failed = sm.children.filter(c => c.status !== 'success');
      if (failed.length > 0) {
        discovery.warnings.push(
          `${failed.length} of ${sm.children.length} child sitemaps in ${sm.url} failed`
        );
        for (const f of failed) {
          discovery.warnings.push(`  ${f.url}: ${f.error || f.status}`);
        }
      }
    }
  }
}

/**
 * Filter out asset/image URLs from a list.
 * Applied after sitemap parsing since sitemaps can include image URLs.
 */
function filterAssetUrls(urls) {
  return urls.filter(url => !SKIP_EXT.test(url));
}

/**
 * Strip internal _urls arrays from discovery entries (they can be huge).
 * The URL counts are preserved in urlCount.
 */
function stripInternalUrls(discovery) {
  for (const sm of discovery.sitemapsAttempted) {
    delete sm._urls;
  }
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

/**
 * Extract all internal links from an HTML page.
 */
function extractLinks(html, pageUrl, acceptedHosts) {
  const $ = cheerio.load(html);
  const links = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const clean = cleanUrl(href, pageUrl, acceptedHosts);
    if (clean) links.add(clean);
  });
  return links;
}

/**
 * Deep link crawl: BFS spider starting from seed URLs.
 * Fetches pages, extracts internal links, follows them.
 * Returns Set of discovered URLs.
 */
async function deepLinkCrawl(seedUrls, acceptedHosts, discovery) {
  const discovered = new Set(seedUrls);
  const queue = [...seedUrls];
  const fetched = new Set();
  let pagesFetched = 0;

  console.log(`  Deep crawl starting with ${seedUrls.length} seed URLs...`);

  while (queue.length > 0 && discovered.size < MAX_CRAWL_URLS && pagesFetched < MAX_CRAWL_PAGES) {
    const url = queue.shift();
    if (fetched.has(url)) continue;
    fetched.add(url);
    pagesFetched++;

    try {
      let html = null;
      try {
        html = await fetchWithGooglebot(url, 15000);
        if (!html || html.length < 200) html = null;
      } catch {
        // Googlebot failed, try ScrapeOWL for first few pages only (expensive)
        if (pagesFetched <= 3) {
          try {
            html = await fetchViaScrapeOwl(url);
          } catch {}
        }
      }

      if (!html) continue;

      // Only parse HTML pages
      if (html.trim().startsWith('<?xml') || html.trim().startsWith('{')) continue;

      const links = extractLinks(html, url, acceptedHosts);
      for (const link of links) {
        if (!discovered.has(link) && discovered.size < MAX_CRAWL_URLS) {
          discovered.add(link);
          if (!fetched.has(link)) {
            queue.push(link);
          }
        }
      }

      if (pagesFetched % 10 === 0) {
        console.log(`  Deep crawl: ${pagesFetched} pages fetched, ${discovered.size} URLs discovered, ${queue.length} in queue`);
      }
    } catch (err) {
      // Skip pages that error out
    }

    // Small delay to be polite
    if (queue.length > 0) {
      await new Promise(r => setTimeout(r, CRAWL_DELAY_MS));
    }
  }

  if (discovered.size >= MAX_CRAWL_URLS) {
    discovery.warnings.push(`Deep crawl stopped at ${MAX_CRAWL_URLS} URL limit`);
  }
  if (pagesFetched >= MAX_CRAWL_PAGES) {
    discovery.warnings.push(`Deep crawl stopped after fetching ${MAX_CRAWL_PAGES} pages (${discovered.size} URLs found)`);
  }

  console.log(`  Deep crawl complete: ${pagesFetched} pages fetched, ${discovered.size} URLs discovered`);
  return discovered;
}

async function crawlDomain(domainInput) {
  const baseUrl = normalizeDomain(domainInput);
  const hostname = new URL(baseUrl).hostname;
  const acceptedHosts = getAcceptedHosts(hostname);

  const discovery = {
    sitemapsAttempted: [],
    robotsTxt: { found: false, sitemapDirectives: [] },
    totalUrlsBeforeDedup: 0,
    totalUrlsAfterDedup: 0,
    deepCrawl: null,
    warnings: [],
  };

  // Build sitemap paths for both www and non-www variants
  const scheme = baseUrl.startsWith('https') ? 'https://' : 'http://';
  const baseVariants = [baseUrl];
  if (hostname.startsWith('www.')) {
    baseVariants.push(scheme + hostname.substring(4));
  } else {
    baseVariants.push(scheme + 'www.' + hostname);
  }

  // Strategy 1: Try standard sitemap paths (using Googlebot + ScrapeOWL fallback)
  const sitemapSuffixes = [
    '/sitemap_index.xml',
    '/sitemap.xml',
    '/wp-sitemap.xml',               // WordPress 5.5+ core sitemaps
    '/sitemap-index.xml',            // Yoast SEO variant
    '/sitemap/sitemap-index.xml',    // some CMS setups
    '/sitemap1.xml',                 // common numbered variant
    '/post-sitemap.xml',             // WordPress Yoast
    '/page-sitemap.xml',             // WordPress Yoast
    '/category-sitemap.xml',         // WordPress Yoast
  ];

  // Build full sitemap URL list (primary domain first, then alt variant)
  const sitemapPaths = [];
  // Primary domain — try all suffixes
  for (const suffix of sitemapSuffixes) {
    sitemapPaths.push(baseUrl + suffix);
  }
  // Alt variant (www ↔ non-www) — only try the main ones
  const altBase = baseVariants[1];
  if (altBase !== baseUrl) {
    for (const suffix of ['/sitemap_index.xml', '/sitemap.xml', '/wp-sitemap.xml']) {
      sitemapPaths.push(altBase + suffix);
    }
  }

  let foundUrls = null;

  for (const fullUrl of sitemapPaths) {
    console.log(`  Trying ${fullUrl}`);
    const result = await tryParseSitemapWithMeta(fullUrl);
    discovery.sitemapsAttempted.push(result);
    if (result.status === 'success' && result.urlCount > 0) {
      foundUrls = result._urls;
      break; // stop trying more paths — first success wins
    }
  }

  if (foundUrls) {
    const filtered = filterAssetUrls(foundUrls);
    discovery.totalUrlsBeforeDedup = filtered.length;
    const deduped = [...new Set(filtered)];
    discovery.totalUrlsAfterDedup = deduped.length;
    buildWarnings(discovery);
    stripInternalUrls(discovery);
    return { urls: deduped, source: 'sitemap', discovery };
  }

  // Strategy 2: Check robots.txt for Sitemap directives
  // Check both www and non-www variants
  let robotsTxt = null;
  for (const variant of baseVariants) {
    robotsTxt = await fetchRobotsTxt(variant);
    if (robotsTxt && robotsTxt.includes('Sitemap:')) break;
  }

  if (robotsTxt && robotsTxt.includes('Sitemap:')) {
    discovery.robotsTxt.found = true;
    const sitemapUrls = robotsTxt
      .split('\n')
      .filter((line) => /^Sitemap:/i.test(line.trim()))
      .map((line) => line.replace(/^Sitemap:\s*/i, '').trim())
      .filter(Boolean);

    discovery.robotsTxt.sitemapDirectives = sitemapUrls;
    console.log(`  Found ${sitemapUrls.length} sitemap(s) in robots.txt — fetching in parallel...`);
    sitemapUrls.forEach(u => console.log(`    ${u}`));

    const smResults = await Promise.allSettled(
      sitemapUrls.map(smUrl => tryParseSitemapWithMeta(smUrl))
    );

    const allUrls = [];
    for (const r of smResults) {
      if (r.status === 'fulfilled') {
        discovery.sitemapsAttempted.push(r.value);
        allUrls.push(...r.value._urls);
      }
    }

    if (allUrls.length > 0) {
      const filtered = filterAssetUrls(allUrls);
      discovery.totalUrlsBeforeDedup = filtered.length;
      const deduped = [...new Set(filtered)];
      discovery.totalUrlsAfterDedup = deduped.length;
      buildWarnings(discovery);
      stripInternalUrls(discovery);
      return { urls: deduped, source: 'sitemap', discovery };
    }
  } else {
    discovery.robotsTxt.found = !!robotsTxt;
  }

  // Strategy 3: Deep link crawl — spider the site by following internal links
  // Start from homepage, follow all internal links BFS-style
  console.log('  No sitemap found, falling back to deep link crawl');

  // Get homepage HTML first
  let homepageHtml = null;
  try {
    homepageHtml = await fetchWithGooglebot(baseUrl, 20000);
    if (!homepageHtml || homepageHtml.length < 500) homepageHtml = null;
  } catch (err) {
    console.warn(`  Googlebot homepage fetch failed: ${err.message}`);
  }

  if (!homepageHtml) {
    try {
      homepageHtml = await fetchViaScrapeOwl(baseUrl, { premiumFirst: true });
    } catch (err) {
      buildWarnings(discovery);
      stripInternalUrls(discovery);
      throw new Error(`Failed to crawl domain: ${err.message}`);
    }
  }

  // Extract seed URLs from homepage
  const seedUrls = new Set();
  seedUrls.add(baseUrl.replace(/\/+$/, '') || baseUrl);
  const homepageLinks = extractLinks(homepageHtml, baseUrl, acceptedHosts);
  for (const link of homepageLinks) {
    seedUrls.add(link);
  }

  console.log(`  Homepage yielded ${seedUrls.size} seed URLs, starting deep crawl...`);

  // Deep crawl: follow links from discovered pages
  const allDiscoveredUrls = await deepLinkCrawl([...seedUrls], acceptedHosts, discovery);

  discovery.deepCrawl = {
    seedUrls: seedUrls.size,
    totalDiscovered: allDiscoveredUrls.size,
  };

  buildWarnings(discovery);
  stripInternalUrls(discovery);
  return { urls: [...allDiscoveredUrls], source: 'deep-crawl', discovery };
}

module.exports = { crawlDomain, normalizeDomain, looksLikeXml };
