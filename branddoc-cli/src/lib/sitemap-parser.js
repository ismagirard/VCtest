const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({ ignoreAttributes: false });

function ensureArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

async function parseSitemap(url, { maxDepth = 3, currentDepth = 0 } = {}) {
  if (currentDepth >= maxDepth) {
    console.warn(`  Max depth (${maxDepth}) reached, skipping: ${url}`);
    return [];
  }

  let response;
  try {
    response = await axios.get(url, { timeout: 15000 });
  } catch (err) {
    console.warn(`  Failed to fetch ${url}: ${err.message}`);
    return [];
  }

  const parsed = parser.parse(response.data);

  // Sitemap index — recurse into child sitemaps
  if (parsed.sitemapindex) {
    const sitemaps = ensureArray(parsed.sitemapindex.sitemap);
    console.log(`  Sitemap index with ${sitemaps.length} child sitemaps`);
    const results = [];
    for (const s of sitemaps) {
      const loc = s.loc || s;
      const childUrls = await parseSitemap(loc, { maxDepth, currentDepth: currentDepth + 1 });
      results.push(...childUrls);
    }
    return [...new Set(results)];
  }

  // Regular urlset
  if (parsed.urlset) {
    const urls = ensureArray(parsed.urlset.url);
    return urls.map((u) => u.loc || u).filter(Boolean);
  }

  console.warn(`  Unrecognized sitemap format at ${url}`);
  return [];
}

function parseSitemapXml(xmlString) {
  const parsed = parser.parse(xmlString);

  if (parsed.sitemapindex) {
    const sitemaps = ensureArray(parsed.sitemapindex.sitemap);
    return { type: 'index', entries: sitemaps.map((s) => s.loc || s) };
  }

  if (parsed.urlset) {
    const urls = ensureArray(parsed.urlset.url);
    return { type: 'urlset', entries: urls.map((u) => u.loc || u).filter(Boolean) };
  }

  return { type: 'unknown', entries: [] };
}

module.exports = { parseSitemap, parseSitemapXml };
