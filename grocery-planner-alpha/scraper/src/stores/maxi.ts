import { StoreAdapter } from "./base-store.js";
import { rateLimitedFetch } from "../lib/rate-limiter.js";
import { log } from "../lib/logger.js";
import type { ScrapedProduct, ScrapedCategory } from "../types.js";

// ── Loblaw PC Express API constants ──

const API_BASE = "https://api.pcexpress.ca/pcx-bff/api/v2/products/search";

// Static API key embedded in maxi.ca's JS bundle
const API_KEY = "C1xujSegT5j3ap3yexJjqhOfELwGKYvz";

const PAGE_SIZE = 48;

// Maxi category search terms mapped to our category slugs.
const CATEGORY_TERMS: { slug: string; nameFr: string; nameEn: string; terms: string[] }[] = [
  { slug: "fruits-legumes", nameFr: "Fruits et l\u00e9gumes", nameEn: "Fruits & Vegetables", terms: ["fruits", "l\u00e9gumes", "pommes", "bananes", "carottes"] },
  { slug: "viandes-volailles", nameFr: "Viandes et volailles", nameEn: "Meat & Poultry", terms: ["viande", "poulet", "boeuf", "porc", "steak"] },
  { slug: "poissons-fruits-de-mer", nameFr: "Poissons et fruits de mer", nameEn: "Fish & Seafood", terms: ["poisson", "saumon", "crevettes", "thon"] },
  { slug: "produits-laitiers", nameFr: "Produits laitiers et oeufs", nameEn: "Dairy & Eggs", terms: ["lait", "fromage", "yogourt", "oeufs", "beurre", "cr\u00e8me"] },
  { slug: "boulangerie", nameFr: "Boulangerie et p\u00e2tisserie", nameEn: "Bakery", terms: ["pain", "boulangerie", "croissant"] },
  { slug: "cereales-dejeuner", nameFr: "C\u00e9r\u00e9ales et d\u00e9jeuner", nameEn: "Cereal & Breakfast", terms: ["c\u00e9r\u00e9ales", "gruau", "d\u00e9jeuner"] },
  { slug: "conserves-sauces", nameFr: "Conserves et sauces", nameEn: "Canned Goods & Sauces", terms: ["conserve", "sauce tomate", "soupe"] },
  { slug: "pates-riz", nameFr: "P\u00e2tes, riz et grains", nameEn: "Pasta, Rice & Grains", terms: ["p\u00e2tes", "riz", "quinoa", "spaghetti"] },
  { slug: "collations", nameFr: "Collations et biscuits", nameEn: "Snacks & Cookies", terms: ["chips", "biscuits", "collation", "craquelins"] },
  { slug: "boissons", nameFr: "Boissons", nameEn: "Beverages", terms: ["jus", "eau", "caf\u00e9", "th\u00e9", "boisson gazeuse"] },
  { slug: "surgeles", nameFr: "Surgel\u00e9s", nameEn: "Frozen Foods", terms: ["surgel\u00e9", "pizza", "cr\u00e8me glac\u00e9e"] },
  { slug: "condiments-epices", nameFr: "Condiments et \u00e9pices", nameEn: "Condiments & Spices", terms: ["\u00e9pices", "moutarde", "ketchup", "mayonnaise"] },
  { slug: "entretien-menager", nameFr: "Entretien m\u00e9nager", nameEn: "Household Cleaning", terms: ["nettoyant", "lessive", "savon vaisselle"] },
  { slug: "soins-personnels", nameFr: "Soins personnels", nameEn: "Personal Care", terms: ["shampooing", "dentifrice", "savon"] },
];

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
      from?: number;
      size?: number;
      totalNumberOfResults?: number;
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
    return CATEGORY_TERMS.map((c) => ({
      slug: c.slug,
      nameFr: c.nameFr,
      nameEn: c.nameEn,
    }));
  }

  async fetchProductPage(
    categorySlug: string,
    page: number
  ): Promise<ScrapedProduct[] | null> {
    const category = CATEGORY_TERMS.find((c) => c.slug === categorySlug);
    if (!category) return null;

    // Each "page" corresponds to a search term in the category
    if (page >= category.terms.length) return null;
    const term = category.terms[page];

    const products = await this.searchProducts(term, 0);
    return products.length > 0 ? products : null;
  }

  protected async searchProducts(
    term: string,
    from: number
  ): Promise<ScrapedProduct[]> {
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
        filters: { "search-bar": [term] },
        sort: {},
        pagination: { from: from + 1 }, // 1-based
        includeFiltersInResponse: false,
      },
      banner: this.banner,
      userData: {
        domainUserId: "00000000-0000-0000-0000-000000000001",
        sessionId: "00000000-0000-0000-0000-000000000002",
      },
      device: { screenSize: 1358 },
      searchRelatedInfo: {
        term,
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
        log.error(`API ${res.status} for "${term}"`);
        return [];
      }

      const data = (await res.json()) as PCXSearchResponse;
      const resultCount = data.searchResultsCount ?? 0;
      if (resultCount === 0) return [];

      return this.parseResponse(data);
    } catch (err) {
      log.error(`Search failed for "${term}": ${err instanceof Error ? err.message : err}`);
      return [];
    }
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
