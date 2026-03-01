import { StoreAdapter } from "./base-store.js";
import { FlyerClient, FlyerKeyExpiredError, type FlyerBlockProduct } from "../lib/flyer-client.js";
import { mapFlyerCategory } from "../lib/flyer-parser.js";
import { log } from "../lib/logger.js";
import type { ScrapedProduct, ScrapedCategory } from "../types.js";

// ── Super C Flyer Adapter ──
//
// Super C's website does NOT have a browsable catalog (unlike Metro).
// The only product data source is the weekly flyer API at
// metrodigital-apim.azure-api.net.
//
// The API returns structured product data with separate FR/EN fields,
// regularPrice, salePrice, categories, and images.

const SUPERC_STORE_ID = "847";
const SUPERC_BANNER_ID = "6141fa7157f8c212fc19dddc";
const SUPERC_FLYER_URL = "https://circulaire.superc.ca/?storeId=847&language=fr";

// Hardcoded key (intercepted from circulaire.superc.ca). Refreshed via Playwright if expired.
let SUPERC_API_KEY = "021027e7c41548bcba5d2315a155816b";

export class SuperCFlyerAdapter extends StoreAdapter {
  readonly chainSlug = "superc";
  readonly chainNameFr = "Super C (circulaire)";
  readonly chainNameEn = "Super C (flyer)";
  readonly parentGroup = "metro_inc";
  readonly website = "https://www.superc.ca";

  private flyerClient: FlyerClient | null = null;
  private products: ScrapedProduct[] | null = null;
  private flyerStartDate: string | null = null;
  private flyerEndDate: string | null = null;

  async fetchCategories(): Promise<ScrapedCategory[]> {
    await this.loadFlyerProducts();

    if (!this.products || this.products.length === 0) {
      return [{ slug: "circulaire", nameFr: "Circulaire", nameEn: "Weekly Flyer" }];
    }

    const cats = new Map<string, ScrapedCategory>();
    for (const p of this.products) {
      const slug = p.categorySlug ?? "circulaire";
      if (!cats.has(slug)) {
        cats.set(slug, {
          slug,
          nameFr: p.categoryNameFr ?? slug,
          nameEn: p.categoryNameEn,
        });
      }
    }

    return Array.from(cats.values());
  }

  async fetchProductPage(
    categorySlug: string,
    page: number
  ): Promise<ScrapedProduct[] | null> {
    if (page > 0 || !this.products) return null;

    return this.products.filter((p) => (p.categorySlug ?? "circulaire") === categorySlug);
  }

  // ── Internal ──

  private async loadFlyerProducts(): Promise<void> {
    if (this.products) return;

    this.flyerClient = new FlyerClient(SUPERC_API_KEY, SUPERC_BANNER_ID);

    let flyer;
    try {
      flyer = await this.flyerClient.getFlyer(SUPERC_STORE_ID);
    } catch (err) {
      if (err instanceof FlyerKeyExpiredError) {
        log.warn("Super C: API key expired, intercepting fresh key via Playwright...");
        await this.refreshApiKey();
        this.flyerClient = new FlyerClient(SUPERC_API_KEY, SUPERC_BANNER_ID);
        flyer = await this.flyerClient.getFlyer(SUPERC_STORE_ID);
      } else {
        throw err;
      }
    }

    if (!flyer) {
      log.error("Super C: could not fetch flyer metadata");
      this.products = [];
      return;
    }

    log.info(`Super C flyer: pub=${flyer.publicationId} (${flyer.startDate} → ${flyer.endDate})`);
    this.flyerStartDate = flyer.startDate;
    this.flyerEndDate = flyer.endDate;

    let blocks;
    try {
      blocks = await this.flyerClient.getFlyerProducts(flyer.publicationId, SUPERC_STORE_ID);
    } catch (err) {
      if (err instanceof FlyerKeyExpiredError) {
        log.warn("Super C: API key expired on pages fetch, refreshing...");
        await this.refreshApiKey();
        this.flyerClient = new FlyerClient(SUPERC_API_KEY, SUPERC_BANNER_ID);
        blocks = await this.flyerClient.getFlyerProducts(flyer.publicationId, SUPERC_STORE_ID);
      } else {
        throw err;
      }
    }

    this.products = [];
    const seen = new Set<string>();

    for (const block of blocks) {
      for (const bp of block.products) {
        if (!bp.sku || seen.has(bp.sku)) continue;

        const product = this.parseBlockProduct(bp);
        if (!product) continue;

        seen.add(bp.sku);
        this.products.push(product);
      }
    }

    log.info(`Super C: parsed ${this.products.length} products from flyer`);
  }

  private parseBlockProduct(bp: FlyerBlockProduct): ScrapedProduct | null {
    // Use structured fields (productFr, salePrice, etc.)
    const nameFr = bp.productFr;
    if (!nameFr || nameFr.length < 2) return null;

    // Parse sale price
    const salePrice = this.parsePrice(bp.salePrice);
    if (!salePrice) return null;

    // Parse regular price (can be "4,79" or "de 5,99 à 6,99" or "13,77/lb - 30,36/kg")
    const regularPrice = this.parsePrice(bp.regularPrice);

    const catSlug = bp.mainCategoryFr
      ? mapFlyerCategory(bp.mainCategoryFr)
      : "circulaire";

    // Extract size from bodyFr (e.g., "250 g, choix varié" → "250 g")
    let size: string | undefined;
    let unit: string | undefined;
    if (bp.bodyFr) {
      const sizeMatch = bp.bodyFr.match(/(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|lb|oz|un)\b)/i);
      if (sizeMatch) {
        size = sizeMatch[1];
        const unitMatch = size.match(/(g|kg|ml|l|lb|oz|un)/i);
        if (unitMatch) unit = unitMatch[1].toLowerCase();
      }
    }

    return {
      externalId: bp.sku,
      nameFr,
      nameEn: bp.productEn || undefined,
      description: bp.bodyFr || undefined,
      imageUrl: bp.productImage || undefined,
      price: regularPrice ?? salePrice, // regular if available, else sale as best available
      salePrice,
      saleStartDate: this.flyerStartDate ? new Date(this.flyerStartDate) : undefined,
      saleEndDate: this.flyerEndDate ? new Date(this.flyerEndDate) : undefined,
      size,
      unit,
      sku: bp.sku,
      categorySlug: catSlug,
      categoryNameFr: bp.mainCategoryFr,
      categoryNameEn: bp.mainCategoryEn,
      source: "flyer",
    };
  }

  /**
   * Parse a price string. Handles:
   * - "5.99" or "5,99" → 5.99
   * - "de 5,99 à 6,99" → 5.99 (takes first/lowest)
   * - "13,77/lb - 30,36/kg" → 13.77
   */
  private parsePrice(priceStr?: string | null): number | null {
    if (!priceStr) return null;
    const matches = priceStr.match(/(\d+[.,]\d{2})/g);
    if (!matches || matches.length === 0) return null;
    const price = parseFloat(matches[0].replace(",", "."));
    return isNaN(price) || price <= 0 ? null : price;
  }

  private async refreshApiKey(): Promise<void> {
    log.info("Super C: intercepting API key from circulaire.superc.ca...");

    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "fr-CA",
    });
    const page = await context.newPage();

    let capturedKey: string | null = null;

    page.on("request", (request) => {
      const reqUrl = request.url();
      if (reqUrl.includes("metrodigital-apim.azure-api.net")) {
        const headers = request.headers();
        const key = headers["ocp-apim-subscription-key"];
        if (key && !capturedKey) {
          capturedKey = key;
          log.info(`Super C: captured fresh API key: ${key.slice(0, 8)}...`);
        }
      }
    });

    try {
      await page.goto(SUPERC_FLYER_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(8000);
    } catch (err) {
      log.warn(`Super C: key interception error: ${err instanceof Error ? err.message : err}`);
    }

    await browser.close();

    if (capturedKey) {
      SUPERC_API_KEY = capturedKey;
    } else {
      log.error("Super C: failed to intercept fresh API key");
    }
  }
}
