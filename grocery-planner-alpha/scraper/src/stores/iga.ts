import { StoreAdapter } from "./base-store.js";
import { log } from "../lib/logger.js";
import type { ScrapedProduct, ScrapedCategory } from "../types.js";

// ── IGA Algolia Adapter ──
//
// IGA (Sobeys/Empire) stores their product catalog in Algolia.
// The search-only API key is public (embedded in iga.ca frontend JS).
// We query directly via the Algolia REST API — no Playwright needed.
//
// Index:   dxp_product_fr  (French product names)
// Store:   8253            (Montreal IGA)
// Auth:    x-algolia-api-key + x-algolia-application-id headers
// Referer: must be https://www.iga.ca
//
// Promotions are embedded in each product hit as a `promotions[]` array.
// Sale price is extracted from promotionReward[].value1Value20[0].value_1.
// Two formats exist:
//   - "Customer Price" (source: ZEDL) → value_1 is in DOLLARS (e.g., "2.49")
//   - "PRICE" (source: CMA, thematic promos) → value_1 is in CENTS (e.g., "229.00" = $2.29)

const ALGOLIA_URL = "https://l0apusih50-dsn.algolia.net/1/indexes/*/queries";
const API_KEY = "022f6cbb0292d0e78f65897fd6dabad9";
const APP_ID = "L0APUSIH50";
const INDEX = "dxp_product_fr";
const STORE_ID = "8253"; // Montreal IGA store

const HITS_PER_PAGE = 1000; // Algolia supports up to 1000

// Rate limiting — be polite to Algolia
const DELAY_BETWEEN_REQUESTS_MS = 300;

// Map IGA's hierarchical category names to our internal slugs
const CATEGORY_SLUG_MAP: Record<string, { slug: string; nameEn: string }> = {
  "Fruits et légumes frais": { slug: "fruits-legumes", nameEn: "Fruits & Vegetables" },
  "Viandes": { slug: "viandes-volailles", nameEn: "Meat & Poultry" },
  "Poissons et fruits de mer": { slug: "poissons-fruits-de-mer", nameEn: "Fish & Seafood" },
  "Produits laitiers et œufs": { slug: "produits-laitiers", nameEn: "Dairy & Eggs" },
  "Pain et boulangerie": { slug: "boulangerie", nameEn: "Bakery" },
  "Essentiels du garde-manger": { slug: "garde-manger", nameEn: "Pantry Essentials" },
  "Collations et bonbons": { slug: "collations", nameEn: "Snacks & Candy" },
  "Boissons prémélangées": { slug: "boissons", nameEn: "Beverages" },
  "Produits surgelés": { slug: "surgeles", nameEn: "Frozen Foods" },
  "Fromage et charcuterie": { slug: "fromage-charcuterie", nameEn: "Cheese & Deli" },
  "Bière, vin et cidres": { slug: "biere-vin", nameEn: "Beer, Wine & Cider" },
  "Cuisine et produits ménagers": { slug: "entretien-menager", nameEn: "Household" },
  "Soins personnels et beauté": { slug: "soins-personnels", nameEn: "Personal Care" },
  "À base de plantes": { slug: "base-de-plantes", nameEn: "Plant-Based" },
  "Prêt-à-manger": { slug: "pret-a-manger", nameEn: "Ready-to-Eat" },
  "Produits pour bébé": { slug: "produits-bebe", nameEn: "Baby Products" },
  "Produits pour animaux de compagnie": { slug: "produits-animaux", nameEn: "Pet Products" },
  "Pharmacie et bien-être": { slug: "pharmacie", nameEn: "Pharmacy & Wellness" },
  "Aliments internationaux": { slug: "aliments-internationaux", nameEn: "International Foods" },
  "Fleurs et jardinage": { slug: "fleurs-jardinage", nameEn: "Flowers & Garden" },
  "Produits ménagers": { slug: "produits-menagers", nameEn: "Household Products" },
  "Produits d'ici": { slug: "produits-ici", nameEn: "Local Products" },
};

// Reverse map: slug → IGA French category name (for Algolia filter)
const SLUG_TO_IGA_CATEGORY = new Map<string, string>();
for (const [igaCat, { slug }] of Object.entries(CATEGORY_SLUG_MAP)) {
  SLUG_TO_IGA_CATEGORY.set(slug, igaCat);
}

// ── Algolia hit types ──

interface AlgoliaPromoReward {
  rewardShortDesc: string;
  rewardTypeCode: number;
  rewardType: number;
  value1Value20?: Array<{ value_1?: string }>;
}

interface AlgoliaPromotion {
  startDate?: number; // Unix timestamp (seconds)
  endDate?: number;
  promotionReward?: AlgoliaPromoReward[];
  source?: string;
  priority?: number;
}

interface AlgoliaHit {
  objectID: string;
  name?: string;
  brand?: string;
  description?: string;
  price?: number;
  priceQuantity?: number;
  upc?: string;
  articleNumber?: string;
  uom?: string;
  weight?: string;
  itemAmountValue?: number;
  itemAmountUnit?: string;
  inStock?: boolean;
  images?: string[];
  categories?: string[];
  hierarchicalCategories?: {
    lvl0?: string[];
    lvl1?: string[];
    lvl2?: string[];
  };
  promotions?: AlgoliaPromotion[];
  isMassOffers?: boolean;
}

interface AlgoliaResponse {
  results: Array<{
    hits: AlgoliaHit[];
    nbHits: number;
    nbPages: number;
    page: number;
    hitsPerPage: number;
    facets?: Record<string, Record<string, number>>;
  }>;
}

// ── IGA Adapter ──

export class IgaAdapter extends StoreAdapter {
  readonly chainSlug = "iga";
  readonly chainNameFr = "IGA";
  readonly chainNameEn = "IGA";
  readonly parentGroup = "sobeys";
  readonly website = "https://www.iga.ca";

  // Cache category list (IGA name → slug)
  private categoryList: ScrapedCategory[] | null = null;

  async fetchCategories(): Promise<ScrapedCategory[]> {
    if (this.categoryList) return this.categoryList;

    // Query Algolia for all categories using facets
    const result = await this.algoliaQuery("", 0, 0, ["hierarchicalCategories.lvl0"]);
    if (!result) {
      log.error("IGA: failed to fetch categories from Algolia");
      return [];
    }

    const r = result.results[0];
    const facets = r.facets?.["hierarchicalCategories.lvl0"] ?? {};
    log.info(`IGA: ${r.nbHits} total products in store ${STORE_ID}`);

    this.categoryList = [];

    for (const igaCatName of Object.keys(facets)) {
      const mapped = CATEGORY_SLUG_MAP[igaCatName];
      if (mapped) {
        this.categoryList.push({
          slug: mapped.slug,
          nameFr: igaCatName,
          nameEn: mapped.nameEn,
        });
        SLUG_TO_IGA_CATEGORY.set(mapped.slug, igaCatName);
      } else {
        // Unmapped category — generate a slug from the French name
        const slug = igaCatName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        this.categoryList.push({
          slug,
          nameFr: igaCatName,
        });
        SLUG_TO_IGA_CATEGORY.set(slug, igaCatName);
        log.warn(`IGA: unmapped category "${igaCatName}" → slug "${slug}"`);
      }
    }

    log.info(`IGA: ${this.categoryList.length} categories`);
    return this.categoryList;
  }

  async fetchProductPage(
    categorySlug: string,
    page: number
  ): Promise<ScrapedProduct[] | null> {
    const igaCatName = SLUG_TO_IGA_CATEGORY.get(categorySlug);
    if (!igaCatName) {
      log.warn(`IGA: unknown category slug "${categorySlug}"`);
      return null;
    }

    const filter = `storeId:${STORE_ID} AND hierarchicalCategories.lvl0:"${igaCatName}"`;
    const result = await this.algoliaQuery("", page, HITS_PER_PAGE, [], filter);
    if (!result) return null;

    const r = result.results[0];
    if (!r.hits || r.hits.length === 0) return null;

    const products: ScrapedProduct[] = [];
    for (const hit of r.hits) {
      const product = this.parseHit(hit, categorySlug, igaCatName);
      if (product) products.push(product);
    }

    if (page === 0) {
      log.info(`IGA: "${igaCatName}" — ${r.nbHits} products, ${r.nbPages} pages`);
    }

    return products;
  }

  // ── Algolia REST API ──

  private async algoliaQuery(
    query: string,
    page: number,
    hitsPerPage: number,
    facets: string[] = [],
    filters?: string
  ): Promise<AlgoliaResponse | null> {
    await this.delay();

    const request: Record<string, any> = {
      indexName: INDEX,
      analyticsTags: ["D", "website"],
      clickAnalytics: true,
      hitsPerPage,
      page,
      query,
    };
    if (facets.length > 0) request.facets = facets;
    if (filters) {
      request.filters = filters;
    } else {
      request.filters = `storeId:${STORE_ID}`;
    }

    try {
      const res = await fetch(ALGOLIA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-algolia-api-key": API_KEY,
          "x-algolia-application-id": APP_ID,
          Referer: "https://www.iga.ca/",
          Origin: "https://www.iga.ca",
        },
        body: JSON.stringify({ requests: [request] }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        log.error(`IGA Algolia error: ${res.status} — ${body.slice(0, 200)}`);
        return null;
      }

      return (await res.json()) as AlgoliaResponse;
    } catch (err) {
      log.error(`IGA Algolia fetch error: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  // ── Hit → ScrapedProduct parser ──

  private parseHit(
    hit: AlgoliaHit,
    categorySlug: string,
    categoryNameFr: string
  ): ScrapedProduct | null {
    if (!hit.name || !hit.price || hit.price <= 0) return null;
    if (hit.inStock === false) return null;

    // External ID: articleNumber is the most stable identifier
    const externalId = hit.articleNumber ?? hit.objectID;

    // Image: first URL (original size) from the images array
    const imageUrl = hit.images?.[0];

    // Size and unit from itemAmountValue/Unit
    let size: string | undefined;
    let unit: string | undefined;
    if (hit.itemAmountValue && hit.itemAmountUnit) {
      unit = hit.itemAmountUnit.toLowerCase();
      size = `${hit.itemAmountValue} ${hit.itemAmountUnit}`;
    } else if (hit.weight) {
      // weight is like "0.4 KG"
      const weightMatch = hit.weight.match(/([\d.]+)\s*(kg|g|lb|oz|l|ml)/i);
      if (weightMatch) {
        size = weightMatch[0];
        unit = weightMatch[2].toLowerCase();
      }
    }

    // Price per unit calculation
    let pricePerUnit: number | undefined;
    if (unit && hit.itemAmountValue && hit.itemAmountValue > 0) {
      // Convert to per-kg or per-L for comparison
      const amt = hit.itemAmountValue;
      const u = unit.toLowerCase();
      if (u === "g" && amt > 0) pricePerUnit = (hit.price / amt) * 1000; // per kg
      else if (u === "ml" && amt > 0) pricePerUnit = (hit.price / amt) * 1000; // per L
      else if (u === "kg") pricePerUnit = hit.price / amt;
      else if (u === "l") pricePerUnit = hit.price / amt;
    }

    // Sale price from promotions
    const { salePrice, saleStartDate, saleEndDate } = this.extractPromotion(
      hit.promotions,
      hit.price
    );

    // Find best category match from lvl0
    const catNameEn = CATEGORY_SLUG_MAP[categoryNameFr]?.nameEn;

    return {
      externalId,
      nameFr: hit.name,
      brand: hit.brand || undefined,
      description: hit.description || undefined,
      imageUrl,
      price: hit.price,
      pricePerUnit: pricePerUnit ? Math.round(pricePerUnit * 100) / 100 : undefined,
      unit,
      size,
      salePrice,
      saleStartDate,
      saleEndDate,
      sku: hit.articleNumber,
      upc: hit.upc,
      categorySlug,
      categoryNameFr,
      categoryNameEn: catNameEn,
    };
  }

  // ── Promotion extraction ──

  private extractPromotion(
    promotions: AlgoliaPromotion[] | undefined,
    regularPrice: number
  ): { salePrice?: number; saleStartDate?: Date; saleEndDate?: Date } {
    if (!promotions || promotions.length === 0) return {};

    let bestSalePrice: number | undefined;
    let bestStartDate: Date | undefined;
    let bestEndDate: Date | undefined;

    const now = Date.now() / 1000; // Unix seconds

    for (const promo of promotions) {
      // Skip expired promotions
      if (promo.endDate && promo.endDate < now) continue;

      if (!promo.promotionReward) continue;

      for (const reward of promo.promotionReward) {
        // Only price-type rewards (rewardTypeCode 4 = customer price)
        if (reward.rewardTypeCode !== 4) continue;

        const rawValue = reward.value1Value20?.[0]?.value_1;
        if (!rawValue) continue;

        let promoPrice = parseFloat(rawValue);
        if (isNaN(promoPrice) || promoPrice <= 0) continue;

        // Detect cents format: "PRICE" rewards from CMA source often use cents
        // e.g., "229.00" = $2.29 (cents), vs "2.49" = $2.49 (dollars)
        // Heuristic: if value > regularPrice * 10, it's likely in cents
        if (promoPrice > regularPrice * 10) {
          promoPrice = promoPrice / 100;
        }

        // Round to 2 decimals
        promoPrice = Math.round(promoPrice * 100) / 100;

        // Only valid if less than regular price
        if (promoPrice >= regularPrice) continue;

        // Take the lowest sale price across all promotions
        if (bestSalePrice === undefined || promoPrice < bestSalePrice) {
          bestSalePrice = promoPrice;
          bestStartDate = promo.startDate ? new Date(promo.startDate * 1000) : undefined;
          bestEndDate = promo.endDate ? new Date(promo.endDate * 1000) : undefined;
        }
      }
    }

    if (bestSalePrice !== undefined) {
      return {
        salePrice: bestSalePrice,
        saleStartDate: bestStartDate,
        saleEndDate: bestEndDate,
      };
    }

    return {};
  }

  // ── Rate limiting ──

  private lastRequestTime = 0;

  private async delay(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < DELAY_BETWEEN_REQUESTS_MS) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}
