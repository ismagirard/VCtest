import type { ScrapedProduct, ScrapedCategory } from "../types.js";

export abstract class StoreAdapter {
  abstract readonly chainSlug: string;
  abstract readonly chainNameFr: string;
  abstract readonly chainNameEn: string;
  abstract readonly parentGroup: string;
  abstract readonly website: string;

  /** Fetch all product categories from the store */
  abstract fetchCategories(): Promise<ScrapedCategory[]>;

  /** Fetch one page of products for a category. Returns null when no more pages. */
  abstract fetchProductPage(
    categorySlug: string,
    page: number
  ): Promise<ScrapedProduct[] | null>;
}
