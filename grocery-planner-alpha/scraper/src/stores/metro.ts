import { StoreAdapter } from "./base-store.js";
import { MetroBrowser, type MetroTab } from "../lib/metro-browser.js";
import { fetchMetroSubcategories } from "../lib/metro-sitemap.js";
import { rateLimitedFetch } from "../lib/rate-limiter.js";
import { log } from "../lib/logger.js";
import { METRO_INC_AISLES, type MetroIncCategory } from "./metro-inc-categories.js";
import type { ScrapedProduct, ScrapedCategory } from "../types.js";

// ── Metro Adapter ──
//
// Primary: Sitemap-driven subcategory browsing via Playwright (~26k products)
//   1. Fetch sitemap XML (no Cloudflare) to discover ~729 subcategory URLs
//   2. For each top-level category, crawl all its subcategories in PARALLEL
//      using multiple browser tabs (shared Cloudflare session)
//   3. Buffer products in memory, drain to runner in virtual pages
//
// Fallback 1: Top-level aisle browsing (~3k products, if sitemap fails)
// Fallback 2: Autocomplete API (~300 products, if Playwright fails)

const ONLINE_GROCERY_BASE = "https://www.metro.ca/epicerie-en-ligne/allees";

// Politeness delay between Playwright page loads per tab (ms)
const POLITENESS_DELAY_MS = 2000;

// Number of concurrent browser tabs for parallel scraping
const PARALLEL_TABS = 4;

// Number of products returned per virtual "page" to the runner
const VIRTUAL_PAGE_SIZE = 100;

// Autocomplete fallback constants
const SESSION_URL = "https://www.metro.ca/en";
const AUTOCOMPLETE_URL = "https://api.metro.ca/en/autocompleteSearchProducts";
const AUTOCOMPLETE_TERMS: Record<string, string[]> = {
  "fruits-legumes": ["pommes", "bananes", "oranges", "carottes", "tomates", "laitue"],
  "viandes-volailles": ["poulet", "boeuf", "porc", "steak", "bacon"],
  "poissons-fruits-de-mer": ["saumon", "crevettes", "thon", "morue"],
  "produits-laitiers": ["lait", "fromage", "yogourt", "oeufs", "beurre"],
  "boissons": ["jus", "eau", "café", "thé"],
  "collations": ["chips", "biscuits", "noix", "chocolat"],
  "surgeles": ["pizza", "frites", "crème glacée"],
  "boulangerie": ["pain", "croissant", "bagels"],
  "entretien-menager": ["nettoyant", "lessive", "savon vaisselle"],
  "soins-personnels": ["shampooing", "dentifrice", "savon"],
};

export class MetroAdapter extends StoreAdapter {
  readonly chainSlug = "metro";
  readonly chainNameFr = "Metro";
  readonly chainNameEn = "Metro";
  readonly parentGroup = "metro_inc";
  readonly website = "https://www.metro.ca";

  protected baseUrl = ONLINE_GROCERY_BASE;

  private browser: MetroBrowser | null = null;
  private browserFailed = false;
  private maxPages: Map<string, number> = new Map();

  // ── Sitemap-driven subcategory state ──
  private subcategoryMap: Map<string, string[]> | null = null;
  private sitemapLoaded = false;
  private useSitemapMode = false;

  // Buffer: eager-loaded products per top-level category
  private productBuffer: Map<string, ScrapedProduct[]> = new Map();
  private bufferOffset: Map<string, number> = new Map();

  // Autocomplete fallback state
  private sessionCookie: string | null = null;

  async fetchCategories(): Promise<ScrapedCategory[]> {
    return this.getAisles().map((a) => ({
      slug: a.slug,
      nameFr: a.nameFr,
      nameEn: a.nameEn,
    }));
  }

  async fetchProductPage(
    categorySlug: string,
    page: number
  ): Promise<ScrapedProduct[] | null> {
    // Load sitemap once per run
    if (!this.sitemapLoaded) {
      await this.loadSitemap();
    }

    // ── Sitemap mode: eager-load on page 0, then drain buffer ──
    if (this.useSitemapMode) {
      if (page === 0) {
        if (!this.browserFailed) {
          try {
            await this.crawlCategorySubcategories(categorySlug);
          } catch (err) {
            if (!this.browser) {
              log.warn(`Metro Playwright failed, falling back to autocomplete: ${err instanceof Error ? err.message : err}`);
              this.browserFailed = true;
            } else {
              log.error(`Metro crawl error for ${categorySlug}: ${err instanceof Error ? err.message : err}`);
              return null;
            }
          }
        }

        // If browser failed during crawl, fall through to autocomplete
        if (this.browserFailed) {
          return this.fetchPageWithAutocomplete(categorySlug, page);
        }
      }

      // Drain buffer in chunks
      const buffer = this.productBuffer.get(categorySlug);
      if (buffer && buffer.length > 0) {
        const offset = this.bufferOffset.get(categorySlug) ?? 0;
        if (offset >= buffer.length) return null;

        const chunk = buffer.slice(offset, offset + VIRTUAL_PAGE_SIZE);
        this.bufferOffset.set(categorySlug, offset + VIRTUAL_PAGE_SIZE);
        return chunk.length > 0 ? chunk : null;
      }

      // Buffer empty — if browser failed midway, try autocomplete
      if (this.browserFailed) {
        return this.fetchPageWithAutocomplete(categorySlug, page);
      }
      return null;
    }

    // ── Non-sitemap fallback: original top-level aisle browsing ──
    if (!this.browserFailed) {
      try {
        return await this.fetchPageWithBrowser(categorySlug, page);
      } catch (err) {
        if (!this.browser) {
          log.warn(`Metro Playwright failed, falling back to autocomplete: ${err instanceof Error ? err.message : err}`);
          this.browserFailed = true;
        } else {
          log.error(`Metro browser error for ${categorySlug} page ${page}: ${err instanceof Error ? err.message : err}`);
          return null;
        }
      }
    }

    return this.fetchPageWithAutocomplete(categorySlug, page);
  }

  async dispose(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    // Free buffers
    this.productBuffer.clear();
    this.bufferOffset.clear();
  }

  // ── Sitemap loading ──

  private async loadSitemap(): Promise<void> {
    this.sitemapLoaded = true;

    const knownAisleSlugs = this.getAisles().map((a) => a.aisleSlug);
    this.subcategoryMap = await fetchMetroSubcategories(knownAisleSlugs);

    if (this.subcategoryMap && this.subcategoryMap.size > 0) {
      const totalSubs = Array.from(this.subcategoryMap.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      log.info(`Metro: sitemap mode enabled — ${totalSubs} subcategories across ${this.subcategoryMap.size} aisles`);
      this.useSitemapMode = true;
    } else {
      log.warn("Metro: sitemap unavailable, falling back to top-level aisle scraping");
      this.useSitemapMode = false;
    }
  }

  // ── Subcategory crawling (sitemap mode, parallel tabs) ──

  private async crawlCategorySubcategories(categorySlug: string): Promise<void> {
    const aisle = this.getAisles().find((a) => a.slug === categorySlug);
    if (!aisle) return;

    const subcategories = this.subcategoryMap?.get(aisle.aisleSlug);

    if (!subcategories || subcategories.length === 0) {
      log.info(`Metro: "${aisle.nameFr}" has no subcategories in sitemap, using top-level aisle`);
      await this.crawlTopLevelAisle(categorySlug, aisle);
      return;
    }

    const browser = await this.ensureBrowser();
    const tabCount = Math.min(PARALLEL_TABS, subcategories.length);
    const tabs = await browser.createTabs(tabCount);

    log.info(
      `Metro: crawling ${subcategories.length} subcategories for "${aisle.nameFr}" with ${tabCount} parallel tabs`
    );

    // Shared state across all workers (thread-safe in JS single-threaded event loop)
    const allProducts: ScrapedProduct[] = [];
    const seenIds = new Set<string>();
    let nextSubIdx = 0; // next subcategory index to claim

    /**
     * Worker: each tab grabs the next subcategory from the shared queue,
     * crawls all its pages, then grabs the next one until done.
     */
    const worker = async (tab: MetroTab): Promise<void> => {
      while (true) {
        // Claim next subcategory (atomic in single-threaded JS)
        const subIdx = nextSubIdx++;
        if (subIdx >= subcategories.length) break;

        const subPath = subcategories[subIdx];
        const subLabel = subPath.split("/").slice(1).join("/") || subPath;
        let pageNum = 0;
        let maxPage = Infinity;

        while (pageNum < maxPage) {
          const url =
            pageNum === 0
              ? `${this.baseUrl}/${subPath}`
              : `${this.baseUrl}/${subPath}-page-${pageNum + 1}`;

          try {
            log.info(
              `Metro: [${aisle.nameFr}] tab${tab.tabId} sub ${subIdx + 1}/${subcategories.length} "${subLabel}" page ${pageNum + 1}${maxPage < Infinity ? `/${maxPage}` : ""}`
            );

            const html = await tab.fetchPage(url);

            if (pageNum === 0) {
              maxPage = await tab.getMaxPage();
            }

            const products = this.parseHtmlResponse(html);

            if (products.length === 0) break;

            // Deduplicate (safe — single-threaded, only one await point modifies seenIds)
            for (const p of products) {
              if (!seenIds.has(p.externalId)) {
                seenIds.add(p.externalId);
                allProducts.push(p);
              }
            }

            pageNum++;

            if (pageNum < maxPage) {
              await new Promise((r) => setTimeout(r, POLITENESS_DELAY_MS));
            }
          } catch (err) {
            log.warn(
              `Metro: tab${tab.tabId} failed on "${subLabel}" page ${pageNum + 1}: ${err instanceof Error ? err.message : err}`
            );
            break; // Skip this subcategory, grab next
          }
        }
      }
    };

    // Launch all workers in parallel
    await Promise.all(tabs.map((tab) => worker(tab)));

    log.info(
      `Metro: "${aisle.nameFr}" — ${allProducts.length} unique products from ${subcategories.length} subcategories`
    );

    this.productBuffer.set(categorySlug, allProducts);
    this.bufferOffset.set(categorySlug, 0);
  }

  /**
   * Fallback for aisles that have no subcategories in the sitemap.
   * Uses the existing top-level aisle pagination approach.
   */
  private async crawlTopLevelAisle(
    categorySlug: string,
    aisle: MetroIncCategory
  ): Promise<void> {
    const browser = await this.ensureBrowser();
    const allProducts: ScrapedProduct[] = [];
    let pageNum = 0;
    let maxPage = Infinity;

    while (pageNum < maxPage) {
      const url =
        pageNum === 0
          ? `${this.baseUrl}/${aisle.aisleSlug}`
          : `${this.baseUrl}/${aisle.aisleSlug}-page-${pageNum + 1}`;

      const html = await browser.fetchPage(url);

      if (pageNum === 0) {
        maxPage = await browser.getMaxPage();
        log.info(`Metro: "${aisle.nameFr}" (top-level) — ${maxPage} pages`);
      }

      const products = this.parseHtmlResponse(html);
      if (products.length === 0) break;

      allProducts.push(...products);
      pageNum++;

      if (pageNum < maxPage) {
        await new Promise((r) => setTimeout(r, POLITENESS_DELAY_MS));
      }
    }

    this.productBuffer.set(categorySlug, allProducts);
    this.bufferOffset.set(categorySlug, 0);
  }

  // ── Top-level aisle browsing (non-sitemap fallback) ──

  protected getAisles(): MetroIncCategory[] {
    return METRO_INC_AISLES;
  }

  private async ensureBrowser(): Promise<MetroBrowser> {
    if (!this.browser) {
      this.browser = new MetroBrowser();
      await this.browser.launch();
    }
    return this.browser;
  }

  private async fetchPageWithBrowser(
    categorySlug: string,
    page: number
  ): Promise<ScrapedProduct[] | null> {
    const aisle = this.getAisles().find((a) => a.slug === categorySlug);
    if (!aisle) return null;

    // Check if we already know this page is past the end
    const known = this.maxPages.get(categorySlug);
    if (known !== undefined && page >= known) return null;

    const browser = await this.ensureBrowser();

    // Build URL: page 0 = base slug, page 1+ = slug-page-{n+1}
    const url =
      page === 0
        ? `${this.baseUrl}/${aisle.aisleSlug}`
        : `${this.baseUrl}/${aisle.aisleSlug}-page-${page + 1}`;

    const html = await browser.fetchPage(url);

    // On first page, discover max pages from pagination
    if (page === 0) {
      const maxPage = await browser.getMaxPage();
      this.maxPages.set(categorySlug, maxPage);
      log.info(`Metro ${aisle.nameFr}: ${maxPage} pages`);
    }

    const products = this.parseHtmlResponse(html);

    if (products.length === 0) {
      // Hit an empty page — update maxPages
      this.maxPages.set(categorySlug, page);
      return null;
    }

    return products;
  }

  // ── Autocomplete fallback ──

  private async fetchPageWithAutocomplete(
    categorySlug: string,
    page: number
  ): Promise<ScrapedProduct[] | null> {
    const terms = AUTOCOMPLETE_TERMS[categorySlug];
    if (!terms || page >= terms.length) return null;

    const term = terms[page];
    const products = await this.fetchAutocomplete(term);
    return products.length > 0 ? products : null;
  }

  private async fetchAutocomplete(term: string): Promise<ScrapedProduct[]> {
    await this.ensureSession();

    const url = `${AUTOCOMPLETE_URL}?freeText=${encodeURIComponent(term)}`;
    const headers: Record<string, string> = {
      "X-Requested-With": "XMLHttpRequest",
      Accept: "*/*",
      Referer: "https://api.metro.ca/en",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "fr-CA,fr;q=0.9,en-CA;q=0.8",
    };

    if (this.sessionCookie) {
      headers["Cookie"] = `JSESSIONID=${this.sessionCookie}`;
    }

    try {
      let res = await rateLimitedFetch(url, { method: "POST", headers }, { delayMs: 800 });

      if (res.status === 403) {
        log.warn(`Metro 403 for "${term}", refreshing session...`);
        this.invalidateSession();
        await this.ensureSession();
        if (this.sessionCookie) headers["Cookie"] = `JSESSIONID=${this.sessionCookie}`;
        res = await rateLimitedFetch(url, { method: "POST", headers }, { delayMs: 1000 });
      }

      if (!res.ok) {
        log.error(`Metro autocomplete ${res.status} for "${term}"`);
        return [];
      }

      const html = await res.text();
      if (!html || html.length < 50) return [];
      return this.parseHtmlResponse(html);
    } catch (err) {
      log.error(`Metro autocomplete failed for "${term}": ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionCookie) return;
    try {
      const res = await rateLimitedFetch(
        SESSION_URL,
        {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "text/html",
            "Accept-Language": "fr-CA,fr;q=0.9",
          },
          redirect: "follow",
        },
        { delayMs: 0, maxRetries: 2 }
      );
      const cookie = res.headers.get("set-cookie") ?? "";
      const m = cookie.match(/JSESSIONID=([^;]+)/);
      if (m) this.sessionCookie = m[1];
    } catch {}
  }

  private invalidateSession(): void {
    this.sessionCookie = null;
  }

  // ── Shared HTML parsing ──

  private parseHtmlResponse(html: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];
    const tiles = html.split(/(?=<div[^>]*class="default-product-tile)/);

    for (const tile of tiles) {
      if (!tile.includes("data-product-code")) continue;
      const product = this.parseTile(tile);
      if (product) products.push(product);
    }

    return products;
  }

  protected parseTile(tile: string): ScrapedProduct | null {
    const codeMatch = tile.match(/data-product-code="([^"]*)"/);
    const nameMatch = tile.match(/data-product-name="([^"]*)"/);
    if (!codeMatch || !nameMatch) return null;

    const externalId = codeMatch[1];
    const nameFr = this.decodeHtmlEntities(nameMatch[1]);
    if (!externalId || !nameFr) return null;

    const priceMatch = tile.match(/data-main-price="([^"]*)"/);
    if (!priceMatch) return null;
    const mainPrice = parseFloat(priceMatch[1]);
    if (isNaN(mainPrice) || mainPrice <= 0) return null;

    const nameEnMatch = tile.match(/data-product-name-en="([^"]*)"/);
    const nameEn = nameEnMatch ? this.decodeHtmlEntities(nameEnMatch[1]) : undefined;

    const brandMatch = tile.match(/data-product-brand="([^"]*)"/);
    const brand = brandMatch ? this.decodeHtmlEntities(brandMatch[1]) : undefined;

    const imgMatch = tile.match(
      /(?:srcset|src)="(https:\/\/product-images\.metro\.ca\/images\/[^",\s]*)"/
    );
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    const sizeMatch = tile.match(/class="head__unit-details"[^>]*>([^<]+)</);
    const size = sizeMatch ? sizeMatch[1].trim() : undefined;

    let pricePerUnit: number | undefined;
    let unit: string | undefined;
    const perUnitMatch = tile.match(/\$(\d+[.,]\d+)\s*\/(\S+)/);
    if (perUnitMatch) {
      pricePerUnit = parseFloat(perUnitMatch[1].replace(",", "."));
      unit = perUnitMatch[2];
    }

    // ── Sale price detection ──
    let price = mainPrice;
    let salePrice: number | undefined;

    // Strategy 1: parse regular price from "Prix régulier ... X,XX $" text
    const beforePriceMatch = tile.match(
      /pricing__before-price[\s\S]*?(\d+[.,]\d+)\s*\$/
    );
    if (beforePriceMatch) {
      const regularPrice = parseFloat(beforePriceMatch[1].replace(",", "."));
      if (!isNaN(regularPrice) && regularPrice > mainPrice) {
        price = regularPrice;
        salePrice = mainPrice;
      }
    }

    // Strategy 2: fallback to data-discount-price (cents) if no before-price text
    if (!salePrice) {
      const discountMatch = tile.match(/data-discount-price="(\d+)"/);
      if (discountMatch) {
        const discountCents = parseInt(discountMatch[1]);
        if (discountCents > 0) {
          const regularPrice = mainPrice + discountCents / 100;
          price = Math.round(regularPrice * 100) / 100;
          salePrice = mainPrice;
        }
      }
    }

    return {
      externalId,
      nameFr,
      nameEn,
      brand,
      price,
      salePrice,
      imageUrl,
      size,
      pricePerUnit,
      unit,
      sku: externalId,
      upc: externalId,
    };
  }

  private decodeHtmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/");
  }
}
