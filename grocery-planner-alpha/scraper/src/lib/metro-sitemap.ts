import { log } from "./logger.js";

// ── Metro Sitemap Parser ──
//
// Fetches Metro's ecommerce sitemap XML and extracts subcategory URLs.
// The sitemap is served without Cloudflare protection (plain HTTP 200).
// Product pages require Playwright, but we only need the category structure here.
//
// Sitemap URL pattern:
//   Category: /epicerie-en-ligne/allees/{parent}/{subcategory}[/{sub-sub}]
//   Product:  /epicerie-en-ligne/allees/{parent}/{sub}/.../{name}/p/{upc}

const SITEMAP_URL = "https://www.metro.ca/sitemap-ecomm-fr-qc.xml";
const ALLEES_PREFIX = "/epicerie-en-ligne/allees/";

/**
 * Fetch Metro's ecommerce sitemap and extract subcategory browse URLs.
 *
 * Returns a Map: parentAisleSlug → subcategoryPath[]
 *   e.g., "garde-manger" → ["garde-manger/pates-et-riz", "garde-manger/farine-et-sucre", ...]
 *
 * Subcategory paths are relative to the /allees/ base and can be appended
 * to build the full browse URL.
 *
 * @param knownAisleSlugs  Only include subcategories whose parent matches one of these slugs
 * @returns Map of parent aisle → subcategory paths, or null on failure
 */
export async function fetchMetroSubcategories(
  knownAisleSlugs: string[]
): Promise<Map<string, string[]> | null> {
  try {
    log.info("Metro sitemap: fetching subcategory structure...");

    const res = await fetch(SITEMAP_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/xml, text/xml, */*",
      },
    });

    if (!res.ok) {
      log.error(`Metro sitemap: HTTP ${res.status}`);
      return null;
    }

    const xml = await res.text();
    if (!xml || xml.length < 1000) {
      log.error("Metro sitemap: empty or too small response");
      return null;
    }

    // Extract all <loc> URLs
    const locRegex = /<loc>([^<]+)<\/loc>/g;
    const urls: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = locRegex.exec(xml)) !== null) {
      urls.push(match[1]);
    }

    if (urls.length === 0) {
      log.error("Metro sitemap: no <loc> URLs found");
      return null;
    }

    log.info(`Metro sitemap: ${urls.length} total URLs in sitemap`);

    // Build a Set of known aisle slugs for fast lookup
    const knownSlugs = new Set(knownAisleSlugs);

    // Filter and group subcategory URLs
    const result = new Map<string, string[]>();
    let skipped = 0;

    for (const url of urls) {
      // Skip product pages (contain /p/)
      if (url.includes("/p/")) continue;

      // Extract the path after /allees/
      const idx = url.indexOf(ALLEES_PREFIX);
      if (idx === -1) continue;

      const pathAfterAllees = url.slice(idx + ALLEES_PREFIX.length).replace(/\/$/, "");
      if (!pathAfterAllees) continue;

      // Split into segments
      const segments = pathAfterAllees.split("/");

      // Skip top-level aisles (only 1 segment like "garde-manger")
      // We want subcategories (2+ segments like "garde-manger/pates-et-riz")
      if (segments.length < 2) continue;

      const parentAisle = segments[0];

      // Only include subcategories whose parent is a known aisle
      if (!knownSlugs.has(parentAisle)) {
        skipped++;
        continue;
      }

      if (!result.has(parentAisle)) {
        result.set(parentAisle, []);
      }
      result.get(parentAisle)!.push(pathAfterAllees);
    }

    // Log summary
    let totalSubs = 0;
    for (const [aisle, subs] of result) {
      totalSubs += subs.length;
      log.info(`Metro sitemap:   ${aisle} → ${subs.length} subcategories`);
    }
    log.info(`Metro sitemap: ${totalSubs} subcategories across ${result.size} aisles (${skipped} skipped)`);

    return result.size > 0 ? result : null;
  } catch (err) {
    log.error(`Metro sitemap: fetch failed — ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
