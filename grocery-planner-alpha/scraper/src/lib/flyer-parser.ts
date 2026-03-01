import { METRO_INC_AISLES } from "../stores/metro-inc-categories.js";

/**
 * Parsed product data from a flyer block's bilingual `contents` field.
 */
export interface ParsedFlyerProduct {
  nameFr: string;
  nameEn?: string;
  price: number;
  size?: string;
  unit?: string;
  /** Multi-buy: "2 for $5" → quantity=2, price=2.50 (per-unit) */
  multiBuyQty?: number;
  multiBuyTotal?: number;
}

/**
 * Parse the bilingual `contents` field from a flyer block product.
 *
 * Metro flyer products have a single `contents` string with French text first,
 * then English text, with embedded prices in both formats (1,99 and 1.99).
 *
 * Examples:
 *   "pommes de terre Russet\nsac 10 lb\n1,99\nRusset potatoes\n10 lb bag\n1.99"
 *   "beurre Lactantia\n454 g\n3,49\nLactantia butter\n454 g\n3.49"
 *   "2/5,00\npoulet entier\n2/5.00\nwhole chicken"
 */
export function parseFlyerContents(contents: string): ParsedFlyerProduct | null {
  if (!contents || contents.trim().length === 0) return null;

  // Normalize: collapse multiple spaces, trim
  const text = contents.replace(/\r/g, "").trim();

  // Try to extract price — look for French-format price (X,XX) or multi-buy (2/X,XX)
  let price: number | undefined;
  let multiBuyQty: number | undefined;
  let multiBuyTotal: number | undefined;

  // Multi-buy: "2/5,00" or "3/9,00" or "2 / 5,00"
  const multiBuyMatch = text.match(/(\d+)\s*\/\s*(\d+[.,]\d{2})/);
  if (multiBuyMatch) {
    multiBuyQty = parseInt(multiBuyMatch[1]);
    multiBuyTotal = parseFloat(multiBuyMatch[2].replace(",", "."));
    if (multiBuyQty > 0 && multiBuyTotal > 0) {
      price = Math.round((multiBuyTotal / multiBuyQty) * 100) / 100;
    }
  }

  // Standard price: "1,99" or "12,49" (French) — pick the first one
  if (!price) {
    const priceMatch = text.match(/(?<!\d[/])(\d+[,]\d{2})(?!\s*[/])/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(",", "."));
    }
  }

  // Fallback: English format "1.99" (but avoid matching sizes like "1.5 kg")
  if (!price) {
    const enPriceMatch = text.match(/(?<!\d[/])(\d+\.\d{2})(?!\s*(?:kg|g|lb|ml|l|oz)\b)/i);
    if (enPriceMatch) {
      price = parseFloat(enPriceMatch[1]);
    }
  }

  if (!price || isNaN(price) || price <= 0) return null;

  // Split into FR/EN halves — the English text typically starts after the first price
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Find the French product name: first non-price, non-empty line
  let nameFr = "";
  let nameEn: string | undefined;
  let size: string | undefined;

  // Heuristic: FR name is in the first few lines before the first price
  const frLines: string[] = [];
  const enLines: string[] = [];
  let foundFirstPrice = false;
  let foundSecondPrice = false;

  for (const line of lines) {
    const isPrice = /^\d+[,.]?\d*[,.]?\d{0,2}$/.test(line) ||
      /^\d+\s*\/\s*\d+[,.]?\d*$/.test(line);

    if (!foundFirstPrice) {
      if (isPrice) {
        foundFirstPrice = true;
      } else {
        frLines.push(line);
      }
    } else if (!foundSecondPrice) {
      if (isPrice) {
        foundSecondPrice = true;
      } else {
        enLines.push(line);
      }
    }
  }

  // French name: first line that's substantial (not just a size/weight)
  nameFr = frLines[0] ?? "";

  // Size: look for weight/volume patterns in FR lines
  for (const l of frLines.slice(1)) {
    if (/\d+\s*(g|kg|ml|l|lb|oz|un)/i.test(l)) {
      size = l;
      break;
    }
  }

  // If no size found in dedicated line, check first line
  if (!size) {
    const sizeInName = nameFr.match(/(\d+\s*(?:g|kg|ml|l|lb|oz|un)\S*)/i);
    if (sizeInName) {
      size = sizeInName[1];
    }
  }

  // English name: first substantial EN line
  if (enLines.length > 0) {
    nameEn = enLines[0];
  }

  if (!nameFr || nameFr.length < 2) return null;

  // Extract unit from size
  let unit: string | undefined;
  if (size) {
    const unitMatch = size.match(/(kg|g|ml|l|lb|oz|un)/i);
    if (unitMatch) unit = unitMatch[1].toLowerCase();
  }

  return {
    nameFr,
    nameEn: nameEn && nameEn.length >= 2 ? nameEn : undefined,
    price,
    size,
    unit,
    multiBuyQty,
    multiBuyTotal,
  };
}

/**
 * Map a flyer category name (French) to our internal category slug.
 * Falls back to a generic slug if no match found.
 */
export function mapFlyerCategory(categoryFr: string): string {
  const lower = categoryFr.toLowerCase();

  // Direct matches or substring matches against METRO_INC_AISLES
  for (const aisle of METRO_INC_AISLES) {
    const aisleLower = aisle.nameFr.toLowerCase();
    if (lower.includes(aisleLower) || aisleLower.includes(lower)) {
      return aisle.slug;
    }
  }

  // Keyword-based fallbacks
  const keywordMap: Record<string, string> = {
    fruit: "fruits-legumes",
    légume: "fruits-legumes",
    legume: "fruits-legumes",
    viande: "viandes-volailles",
    volaille: "viandes-volailles",
    poulet: "viandes-volailles",
    boeuf: "viandes-volailles",
    porc: "viandes-volailles",
    poisson: "poissons-fruits-de-mer",
    "fruits de mer": "poissons-fruits-de-mer",
    lait: "produits-laitiers",
    fromage: "produits-laitiers",
    yogourt: "produits-laitiers",
    oeuf: "produits-laitiers",
    beurre: "produits-laitiers",
    pain: "boulangerie",
    boulangerie: "boulangerie",
    pâtisserie: "boulangerie",
    boisson: "boissons",
    jus: "boissons",
    café: "boissons",
    surgelé: "surgeles",
    congelé: "surgeles",
    collation: "collations",
    chips: "collations",
    biscuit: "collations",
    entretien: "entretien-menager",
    nettoy: "entretien-menager",
    soin: "soins-personnels",
    beauté: "soins-personnels",
    bébé: "bebe",
    couche: "bebe",
    animal: "animaux",
    chien: "animaux",
    chat: "animaux",
    charcuter: "charcuteries",
    "plat préparé": "charcuteries",
    pharmacie: "pharmacie",
    bio: "epicerie-biologique",
    organi: "epicerie-biologique",
    végétar: "vegetarien-vegetalien",
    végétal: "vegetarien-vegetalien",
    bière: "bieres-vins",
    vin: "bieres-vins",
  };

  for (const [keyword, slug] of Object.entries(keywordMap)) {
    if (lower.includes(keyword)) return slug;
  }

  return "garde-manger"; // default fallback
}
