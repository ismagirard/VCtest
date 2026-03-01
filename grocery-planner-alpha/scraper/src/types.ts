export interface ScrapedProduct {
  externalId: string;
  nameFr: string;
  nameEn?: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  price: number;
  pricePerUnit?: number;
  unit?: string;
  size?: string;
  salePrice?: number;
  saleStartDate?: Date;
  saleEndDate?: Date;
  sku?: string;
  upc?: string;
  categorySlug?: string;
  categoryNameFr?: string;
  categoryNameEn?: string;
  /** Where the data came from: 'catalog' for store website, 'flyer' for weekly circular */
  source?: "catalog" | "flyer";
}

export interface ScrapedCategory {
  slug: string;
  nameFr: string;
  nameEn?: string;
}

export interface ScrapeProgress {
  totalProducts: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  currentCategory?: string;
  currentPage?: number;
}
