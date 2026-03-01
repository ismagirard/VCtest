import { StoreAdapter } from "./base-store.js";
import { rateLimitedFetch } from "../lib/rate-limiter.js";
import { log } from "../lib/logger.js";
import type { ScrapedProduct, ScrapedCategory } from "../types.js";

// ── Loblaw PC Express API constants ──

const API_BASE = "https://api.pcexpress.ca/pcx-bff/api/v2/products/search";

// Static API key embedded in maxi.ca's JS bundle
const API_KEY = "C1xujSegT5j3ap3yexJjqhOfELwGKYvz";

// ── Category configuration ──
//
// The Loblaw API returns categories via the "category" filter group.
// Top-level "Alimentation" (27985) has 14 food subcategories.
// We also scrape non-food grocery categories (household, personal care, etc.)
// since people buy those at the grocery store.
//
// Category IDs are shared between Maxi and Provigo (same API, different stores).

interface LoblawCategory {
  id: string;        // Loblaw category ID (e.g., "28000")
  slug: string;      // Internal slug for DB
  nameFr: string;    // French display name
  nameEn: string;    // English display name
}

// Food subcategories (children of 27985 "Alimentation")
const FOOD_CATEGORIES: LoblawCategory[] = [
  { id: "28000", slug: "fruits-legumes", nameFr: "Fruits et légumes", nameEn: "Fruits & Vegetables" },
  { id: "27998", slug: "viandes-volailles", nameFr: "Viande", nameEn: "Meat" },
  { id: "27999", slug: "poissons-fruits-de-mer", nameFr: "Poissons et fruits de mer", nameEn: "Fish & Seafood" },
  { id: "28003", slug: "produits-laitiers", nameFr: "Produits laitiers et œufs", nameEn: "Dairy & Eggs" },
  { id: "28002", slug: "boulangerie", nameFr: "Boulangerie", nameEn: "Bakery" },
  { id: "28001", slug: "charcuterie", nameFr: "Charcuterie", nameEn: "Deli" },
  { id: "28006", slug: "garde-manger", nameFr: "Garde-manger", nameEn: "Pantry" },
  { id: "57025", slug: "collations", nameFr: "Grignotines, croustilles et friandises", nameEn: "Snacks & Candy" },
  { id: "28004", slug: "boissons", nameFr: "Boissons", nameEn: "Beverages" },
  { id: "28005", slug: "surgeles", nameFr: "Produits surgelés", nameEn: "Frozen Foods" },
  { id: "27996", slug: "repas-prepares", nameFr: "Repas préparés", nameEn: "Prepared Meals" },
  { id: "28189", slug: "bio-naturel", nameFr: "Naturels et biologiques", nameEn: "Natural & Organic" },
  { id: "58044", slug: "aliments-internationaux", nameFr: "Aliments internationaux", nameEn: "International Foods" },
  { id: "28236", slug: "biere-vin", nameFr: "Vins et bières", nameEn: "Wine & Beer" },
];

// Non-food categories also sold in grocery stores
const NON_FOOD_CATEGORIES: LoblawCategory[] = [
  { id: "27986", slug: "entretien-menager", nameFr: "Maison", nameEn: "Household" },
  { id: "28011", slug: "articles-menagers", nameFr: "Articles Ménagers", nameEn: "Housewares" },
  { id: "27994", slug: "soins-personnels", nameFr: "Soins personnels et produits de beauté", nameEn: "Personal Care & Beauty" },
  { id: "59630", slug: "sante-bien-etre", nameFr: "Santé et bien-être", nameEn: "Health & Wellness" },
  { id: "27987", slug: "produits-bebe", nameFr: "Bébés", nameEn: "Baby" },
  { id: "27988", slug: "produits-animaux", nameFr: "Aliments et fournitures pour animaux", nameEn: "Pet Food & Supplies" },
];

const ALL_CATEGORIES = [...FOOD_CATEGORIES, ...NON_FOOD_CATEGORIES];

// Map slug → Loblaw category for quick lookup
const SLUG_TO_CATEGORY = new Map<string, LoblawCategory>();
for (const cat of ALL_CATEGORIES) {
  SLUG_TO_CATEGORY.set(cat.slug, cat);
}

// ── Response types (matched to real API responses) ──

interface PCXProductTile {
  title?: string;
  productId?: string;
  articleNumber?: string;
  brand?: string;
  description?: string;
  packageSizing?: string;
  link?: string;
  pricing?: {
    price?: string;
    wasPrice?: string | null;
    displayPrice?: string;
    type?: string;
  };
  pricingUnits?: {
    type?: string;
    unit?: string;
    weighted?: boolean;
  };
  imageAssets?: {
    smallUrl?: string;
    largeUrl?: string;
    thumbnailUrl?: string;
  };
  badges?: Array<{ type?: string; text?: string }>;
}

interface PCXComponent {
  componentId?: string;
  data?: {
    productTiles?: PCXProductTile[];
    pagination?: {
      pageNumber?: number;
      pageSize?: number;
      hasMore?: boolean;
      totalResults?: number;
    };
  };
}

interface PCXSearchResponse {
  searchResultsCount?: number;
  layout?: {
    sections?: {
      mainContentCollection?: {
        components?: PCXComponent[];
      };
    };
  };
}

// ── Maxi Adapter ──

export class MaxiAdapter extends StoreAdapter {
  readonly chainSlug = "maxi";
  readonly chainNameFr = "Maxi";
  readonly chainNameEn = "Maxi";
  readonly parentGroup = "loblaw";
  readonly website = "https://www.maxi.ca";

  protected banner = "maxi";
  protected storeId = "1016"; // Valid Maxi store in Quebec
  protected origin = "https://www.maxi.ca";

  async fetchCategories(): Promise<ScrapedCategory[]> {
    return ALL_CATEGORIES.map((c) => ({
      slug: c.slug,
      nameFr: c.nameFr,
      nameEn: c.nameEn,
    }));
  }

  async fetchProductPage(
    categorySlug: string,
    page: number
  ): Promise<ScrapedProduct[] | null> {
    const category = SLUG_TO_CATEGORY.get(categorySlug);
    if (!category) return null;

    // Loblaw API uses 1-based page numbers
    const pageNum = page + 1;

    const products = await this.fetchCategoryPage(category.id, pageNum);
    if (!products || products.length === 0) return null;

    return products;
  }

  // ── API query with category filter + proper pagination ──

  protected async fetchCategoryPage(
    categoryId: string,
    pageNum: number
  ): Promise<ScrapedProduct[] | null> {
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, "0")}${String(today.getMonth() + 1).padStart(2, "0")}${today.getFullYear()}`;

    const body = {
      cart: { cartId: "00000000-0000-0000-0000-000000000000" },
      fulfillmentInfo: {
        storeId: this.storeId,
        pickupType: "STORE",
        offerType: "OG",
        date: dateStr,
        timeSlot: null,
      },
      listingInfo: {
        filters: { category: [categoryId] },
        sort: {},
        pagination: { from: pageNum },
        includeFiltersInResponse: false,
      },
      banner: this.banner,
      userData: {
        domainUserId: "00000000-0000-0000-0000-000000000001",
        sessionId: "00000000-0000-0000-0000-000000000002",
      },
      device: { screenSize: 1358 },
      searchRelatedInfo: {
        term: "",
        options: [{ name: "rmp.unifiedSearchVariant", value: "Y" }],
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "*/*",
      "Site-Banner": this.banner,
      "X-Apikey": API_KEY,
      "X-Application-Type": "Web",
      "X-Channel": "web",
      "X-Loblaw-Tenant-Id": "ONLINE_GROCERIES",
      "Accept-Language": "fr",
      "Business-User-Agent": "PCXWEB",
      Origin: this.origin,
      Referer: `${this.origin}/`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    try {
      const res = await rateLimitedFetch(API_BASE, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        log.error(`${this.chainNameFr} API ${res.status} for category ${categoryId} page ${pageNum}`);
        return null;
      }

      const data = (await res.json()) as PCXSearchResponse;
      const parsed = this.parseResponse(data);

      // Log total on first page
      if (pageNum === 1) {
        const totalResults = this.extractPagination(data)?.totalResults ?? 0;
        const pages = totalResults > 0 ? Math.ceil(totalResults / 33) : 0; // ~33 product tiles per page
        log.info(`${this.chainNameFr}: category ${categoryId} — ${totalResults} products (~${pages} pages)`);
      }

      // Check if there are more pages
      const pagination = this.extractPagination(data);
      if (pagination && pagination.hasMore === false) {
        // This is the last page; return these products, next call will return null
        // (the runner stops when we return an empty array, not null,
        //  so we need to let this page through and return null on next call)
      }

      return parsed.length > 0 ? parsed : null;
    } catch (err) {
      log.error(`${this.chainNameFr}: category page fetch failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  private extractPagination(data: PCXSearchResponse) {
    const components = data.layout?.sections?.mainContentCollection?.components ?? [];
    for (const comp of components) {
      if (comp.componentId === "productGridComponent" && comp.data?.pagination) {
        return comp.data.pagination;
      }
    }
    return null;
  }

  private parseResponse(data: PCXSearchResponse): ScrapedProduct[] {
    const components = data.layout?.sections?.mainContentCollection?.components ?? [];

    // Collect productTiles from productGridComponent components (skip ads)
    const tiles: PCXProductTile[] = [];
    for (const comp of components) {
      if (comp.componentId === "productGridComponent" && comp.data?.productTiles) {
        tiles.push(...comp.data.productTiles);
      }
    }

    return tiles
      .filter((p) => p.productId && p.title && p.pricing?.price)
      .map((p) => this.mapProduct(p));
  }

  protected mapProduct(p: PCXProductTile): ScrapedProduct {
    const priceStr = p.pricing?.price ?? "0";
    const wasPriceStr = p.pricing?.wasPrice;
    const price = parseFloat(priceStr);
    const wasPrice = wasPriceStr ? parseFloat(wasPriceStr) : null;
    const isOnSale = wasPrice !== null && wasPrice > price;

    // Parse size and unit from packageSizing, e.g. "2 l, 0,36 $/100ml"
    const size = p.packageSizing?.split(",")[0]?.trim();
    let pricePerUnit: number | undefined;
    let unit: string | undefined;
    if (p.packageSizing) {
      // Match patterns like "0,36 $/100ml" or "3,74 $/100g"
      const perUnitMatch = p.packageSizing.match(/(\d+[.,]?\d*)\s*\$\/(\S+)/);
      if (perUnitMatch) {
        pricePerUnit = parseFloat(perUnitMatch[1].replace(",", "."));
        unit = perUnitMatch[2];
      }
    }
    if (!unit && p.pricingUnits?.unit) {
      unit = p.pricingUnits.unit;
    }

    // Build image URL from article number
    const articleNum = p.articleNumber;
    const imageUrl = articleNum
      ? `https://assets.shop.loblaws.ca/products/${articleNum}/b2/fr/front/${articleNum}_front_a06_@2.png`
      : undefined;

    return {
      externalId: p.productId!,
      nameFr: p.title!,
      brand: p.brand || undefined,
      description: p.description || undefined,
      imageUrl,
      price: isOnSale ? wasPrice! : price,
      salePrice: isOnSale ? price : undefined,
      pricePerUnit,
      unit,
      size,
      sku: articleNum || undefined,
      upc: articleNum || undefined,
    };
  }
}
