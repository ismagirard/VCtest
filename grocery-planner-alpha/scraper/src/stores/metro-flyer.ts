import { StoreAdapter } from "./base-store.js";
import { FlyerClient, FlyerKeyExpiredError, type FlyerBlockProduct } from "../lib/flyer-client.js";
import { mapFlyerCategory } from "../lib/flyer-parser.js";
import { log } from "../lib/logger.js";
import type { ScrapedProduct, ScrapedCategory } from "../types.js";

// ── Metro Flyer Adapter ──
//
// Weekly specials from Metro's circular (metrodigital-apim.azure-api.net).
// Run AFTER the "metro" catalog scrape to overlay sale prices onto existing products.
// Products merge via chainSlug="metro" + externalId (sku).
//
// When a product already exists in DB from the catalog scrape, the flyer upsert
// only updates salePrice, saleStartDate, saleEndDate — preserving the regular price.

// Store 601 = Montreal Metro (valid for Quebec flyer zone)
const METRO_STORE_ID = "601";
const METRO_BANNER_ID = "62e3ee07ffe0e6f10778a56e";
const METRO_FLYER_URL = "https://circulaire.metro.ca/?storeId=601&language=fr";

// Intercepted from circulaire.metro.ca via Playwright
let METRO_API_KEY = "0a112db32b2f42588b54063b05dfbc90";

export class MetroFlyerAdapter extends StoreAdapter {
  readonly chainSlug = "metro"; // same as catalog — products merge in DB
  readonly chainNameFr = "Metro (circulaire)";
  readonly chainNameEn = "Metro (flyer)";
  readonly parentGroup = "metro_inc";
  readonly website = "https://www.metro.ca";

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

    this.flyerClient = new FlyerClient(METRO_API_KEY, METRO_BANNER_ID);

    let flyer;
    try {
      flyer = await this.flyerClient.getFlyer(METRO_STORE_ID);
    } catch (err) {
      if (err instanceof FlyerKeyExpiredError) {
        log.warn("Metro flyer: API key expired, intercepting fresh key via Playwright...");
        await this.refreshApiKey();
        this.flyerClient = new FlyerClient(METRO_API_KEY, METRO_BANNER_ID);
        flyer = await this.flyerClient.getFlyer(METRO_STORE_ID);
      } else {
        throw err;
      }
    }

    if (!flyer) {
      log.error("Metro flyer: could not fetch flyer metadata");
      this.products = [];
      return;
    }

    log.info(`Metro flyer: pub=${flyer.publicationId} (${flyer.startDate} → ${flyer.endDate})`);
    this.flyerStartDate = flyer.startDate;
    this.flyerEndDate = flyer.endDate;

    let blocks;
    try {
      blocks = await this.flyerClient.getFlyerProducts(flyer.publicationId, METRO_STORE_ID);
    } catch (err) {
      if (err instanceof FlyerKeyExpiredError) {
        log.warn("Metro flyer: API key expired on pages fetch, refreshing...");
        await this.refreshApiKey();
        this.flyerClient = new FlyerClient(METRO_API_KEY, METRO_BANNER_ID);
        blocks = await this.flyerClient.getFlyerProducts(flyer.publicationId, METRO_STORE_ID);
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

    log.info(`Metro flyer: parsed ${this.products.length} products from flyer`);
  }

  private parseBlockProduct(bp: FlyerBlockProduct): ScrapedProduct | null {
    const nameFr = bp.productFr;
    if (!nameFr || nameFr.length < 2) return null;

    const salePrice = this.parsePrice(bp.salePrice);
    if (!salePrice) return null;

    const regularPrice = this.parsePrice(bp.regularPrice);

    const catSlug = bp.mainCategoryFr
      ? mapFlyerCategory(bp.mainCategoryFr)
      : "circulaire";

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
      price: regularPrice ?? salePrice,
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

  private parsePrice(priceStr?: string | null): number | null {
    if (!priceStr) return null;
    const matches = priceStr.match(/(\d+[.,]\d{2})/g);
    if (!matches || matches.length === 0) return null;
    const price = parseFloat(matches[0].replace(",", "."));
    return isNaN(price) || price <= 0 ? null : price;
  }

  private async refreshApiKey(): Promise<void> {
    log.info("Metro flyer: intercepting API key from circulaire.metro.ca...");

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
          log.info(`Metro flyer: captured fresh API key: ${key.slice(0, 8)}...`);
        }
      }
    });

    try {
      await page.goto(METRO_FLYER_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(8000);
    } catch (err) {
      log.warn(`Metro flyer: key interception error: ${err instanceof Error ? err.message : err}`);
    }

    await browser.close();

    if (capturedKey) {
      METRO_API_KEY = capturedKey;
    } else {
      log.error("Metro flyer: failed to intercept fresh API key");
    }
  }
}
