// Shared category definitions for Metro Inc stores (Metro, Super C).
// Each entry maps to an aisle URL slug on the store website.

export interface MetroIncCategory {
  slug: string;        // Our internal category slug (matches DB)
  nameFr: string;
  nameEn: string;
  aisleSlug: string;   // URL path segment on the store website
}

// Metro's 24 aisles mapped to our category schema.
// Some Metro aisles map to the same internal category; we keep them separate
// for better coverage and accuracy.
export const METRO_INC_AISLES: MetroIncCategory[] = [
  { slug: "fruits-legumes", nameFr: "Fruits et légumes", nameEn: "Fruits & Vegetables", aisleSlug: "fruits-et-legumes" },
  { slug: "produits-laitiers", nameFr: "Produits laitiers et oeufs", nameEn: "Dairy & Eggs", aisleSlug: "produits-laitiers-et-oeufs" },
  { slug: "garde-manger", nameFr: "Garde-Manger", nameEn: "Pantry", aisleSlug: "garde-manger" },
  { slug: "plats-cuisines", nameFr: "Plats cuisinés", nameEn: "Prepared Meals", aisleSlug: "plats-cuisines" },
  { slug: "format-economique", nameFr: "Format économique", nameEn: "Value Size", aisleSlug: "format-economique" },
  { slug: "boissons", nameFr: "Boissons", nameEn: "Beverages", aisleSlug: "boissons" },
  { slug: "bieres-vins", nameFr: "Bières et vins", nameEn: "Beer & Wine", aisleSlug: "bieres-et-vins" },
  { slug: "viandes-volailles", nameFr: "Viandes et volailles", nameEn: "Meat & Poultry", aisleSlug: "viandes-et-volailles" },
  { slug: "vegetarien-vegetalien", nameFr: "Aliments végétariens et végétaliens", nameEn: "Vegetarian & Vegan", aisleSlug: "aliments-vegetariens-et-vegetaliens" },
  { slug: "epicerie-biologique", nameFr: "Épicerie biologique", nameEn: "Organic Grocery", aisleSlug: "epicerie-biologique" },
  { slug: "collations", nameFr: "Collations", nameEn: "Snacks", aisleSlug: "collations" },
  { slug: "surgeles", nameFr: "Produits surgelés", nameEn: "Frozen Foods", aisleSlug: "produits-surgeles" },
  { slug: "boulangerie", nameFr: "Pains et pâtisseries", nameEn: "Bakery", aisleSlug: "pains-et-patisseries" },
  { slug: "charcuteries", nameFr: "Charcuteries et plats préparés", nameEn: "Deli & Prepared Foods", aisleSlug: "charcuteries-et-plats-prepares" },
  { slug: "poissons-fruits-de-mer", nameFr: "Poissons et fruits de mer", nameEn: "Fish & Seafood", aisleSlug: "poissons-et-fruits-de-mer" },
  { slug: "cuisine-du-monde", nameFr: "Cuisine du monde", nameEn: "World Cuisine", aisleSlug: "cuisine-du-monde" },
  { slug: "entretien-menager", nameFr: "Entretien ménager et nettoyage", nameEn: "Household Cleaning", aisleSlug: "entretien-menager-et-nettoyage" },
  { slug: "bebe", nameFr: "Bébé", nameEn: "Baby", aisleSlug: "bebe" },
  { slug: "soins-personnels", nameFr: "Soins et beauté", nameEn: "Health & Beauty", aisleSlug: "soins-et-beaute" },
  { slug: "animaux", nameFr: "Essentiels pour animaux", nameEn: "Pet Essentials", aisleSlug: "essentiels-pour-animaux" },
  { slug: "pharmacie", nameFr: "Pharmacie", nameEn: "Pharmacy", aisleSlug: "pharmacie" },
];
