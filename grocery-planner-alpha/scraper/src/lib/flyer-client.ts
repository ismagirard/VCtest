import { rateLimitedFetch } from "./rate-limiter.js";
import { log } from "./logger.js";

// ── Types ──

export interface FlyerMetadata {
  /** Publication number (used for pages endpoint, from `title` field) */
  publicationId: string;
  /** Internal flyerId (from `flyerId` field) */
  flyerId: string;
  storeId: string;
  startDate: string;
  endDate: string;
  totalPages: number;
}

export interface FlyerBlock {
  blockId: string;
  pageIndex: number;
  products: FlyerBlockProduct[];
}

export interface FlyerBlockProduct {
  sku: string;
  productFr?: string;
  productEn?: string;
  bodyFr?: string;
  bodyEn?: string;
  regularPrice?: string;
  salePrice?: string;
  contents?: string;
  mainCategoryFr?: string;
  mainCategoryEn?: string;
  productImage?: string;
}

export class FlyerKeyExpiredError extends Error {
  constructor(status: number) {
    super(`Flyer API returned ${status} — subscription key may be expired`);
    this.name = "FlyerKeyExpiredError";
  }
}

// ── Client ──

const API_BASE = "https://metrodigital-apim.azure-api.net";

export class FlyerClient {
  private subscriptionKey: string;
  private bannerId: string;

  constructor(subscriptionKey: string, bannerId: string) {
    this.subscriptionKey = subscriptionKey;
    this.bannerId = bannerId;
  }

  /**
   * Fetch current flyer metadata for a store.
   * The `publicationId` (from the `title` field) is used for the pages endpoint.
   */
  async getFlyer(storeId: string, date?: string): Promise<FlyerMetadata | null> {
    const dateParam = date ?? new Date().toISOString().slice(0, 10);
    const url = `${API_BASE}/api/flyers/${storeId}/bil?date=${dateParam}`;

    log.info(`FlyerClient: fetching flyer metadata for store ${storeId}...`);
    const res = await this.fetchWithAuth(url);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new FlyerKeyExpiredError(res.status);
      }
      log.error(`FlyerClient: flyer metadata ${res.status} for store ${storeId}`);
      return null;
    }

    const data = await res.json() as any;

    const flyer = data?.flyers?.[0] ?? data?.[0] ?? data;
    if (!flyer) {
      log.warn("FlyerClient: no flyer found in response");
      return null;
    }

    // `title` = publication number used for pages endpoint (e.g., "82703")
    // `flyerId` = internal ID (e.g., "699f2cb0b824facb11f63f30")
    const publicationId = flyer.title;
    const flyerId = flyer.flyerId ?? flyer.id;

    if (!publicationId) {
      log.warn("FlyerClient: could not extract publication ID (title) from response");
      log.info(`FlyerClient: response keys: ${Object.keys(flyer).join(", ")}`);
      return null;
    }

    return {
      publicationId: String(publicationId),
      flyerId: String(flyerId ?? publicationId),
      storeId,
      startDate: flyer.startDate ?? flyer.validFrom ?? dateParam,
      endDate: flyer.endDate ?? flyer.validTo ?? dateParam,
      totalPages: flyer.pageCount ?? flyer.totalPages ?? 0,
    };
  }

  /**
   * Fetch all pages of a flyer and extract product blocks.
   * Uses publicationId (title) from getFlyer() result.
   */
  async getFlyerProducts(publicationId: string, storeId: string): Promise<FlyerBlock[]> {
    const url = `${API_BASE}/api/pages/${publicationId}/${storeId}/bil/`;

    log.info(`FlyerClient: fetching flyer pages for publication=${publicationId}...`);
    const res = await this.fetchWithAuth(url);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new FlyerKeyExpiredError(res.status);
      }
      log.error(`FlyerClient: flyer pages ${res.status}`);
      return [];
    }

    const pages = await res.json() as any[];
    if (!Array.isArray(pages)) {
      log.warn("FlyerClient: unexpected response format (not an array)");
      return [];
    }

    const blocks: FlyerBlock[] = [];

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const page = pages[pageIdx];
      const pageBlocks = page?.blocks ?? [];

      for (const block of pageBlocks) {
        const products: FlyerBlockProduct[] = [];

        const blockProducts = block?.products ?? [];
        for (const p of blockProducts) {
          // Skip empty entries (link blocks, etc.)
          if (!p.sku && !p.productFr && !p.contents) continue;

          products.push({
            sku: p.sku ?? "",
            productFr: p.productFr ?? undefined,
            productEn: p.productEn ?? undefined,
            bodyFr: p.bodyFr ?? undefined,
            bodyEn: p.bodyEn ?? undefined,
            regularPrice: p.regularPrice ?? undefined,
            salePrice: p.salePrice ?? undefined,
            contents: p.contents ?? undefined,
            mainCategoryFr: p.mainCategoryFr ?? undefined,
            mainCategoryEn: p.mainCategoryEn ?? undefined,
            productImage: p.productImage ?? undefined,
          });
        }

        if (products.length > 0) {
          blocks.push({
            blockId: block.blockId ?? block.id ?? `page${pageIdx}-block`,
            pageIndex: pageIdx,
            products,
          });
        }
      }
    }

    log.info(`FlyerClient: ${blocks.length} blocks with products across ${pages.length} pages`);
    return blocks;
  }

  // ── Internal ──

  private async fetchWithAuth(url: string): Promise<Response> {
    return rateLimitedFetch(url, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": this.subscriptionKey,
        "banner": this.bannerId,
        "X-Api-Version": "3.0",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    }, { delayMs: 300, maxRetries: 2 });
  }
}
