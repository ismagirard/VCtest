import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    console.error("Set SEED_PASSWORD env var: SEED_PASSWORD=yourpassword npx prisma db seed");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // ── Seed admin user ──
  const user = await prisma.user.upsert({
    where: { email: "admin@grocery-planner.local" },
    update: { firstName: "Admin" },
    create: {
      email: "admin@grocery-planner.local",
      firstName: "Admin",
      password: hashedPassword,
      householdSize: 1,
      mealsPerDay: 3,
      cookingTimePreference: "moderate",
      budgetPreference: "moderate",
      groceryFrequency: "weekly",
      agentMode: "ask",
    },
  });
  console.log("Seeded user:", user.email);

  // ── Seed store chains ──
  const stores = [
    { slug: "maxi", nameFr: "Maxi", nameEn: "Maxi", website: "https://www.maxi.ca", parentGroup: "loblaw" },
    { slug: "provigo", nameFr: "Provigo", nameEn: "Provigo", website: "https://www.provigo.ca", parentGroup: "loblaw" },
    { slug: "iga", nameFr: "IGA", nameEn: "IGA", website: "https://www.iga.net", parentGroup: "sobeys" },
    { slug: "metro", nameFr: "Metro", nameEn: "Metro", website: "https://www.metro.ca", parentGroup: "metro_inc" },
    { slug: "superc", nameFr: "Super C", nameEn: "Super C", website: "https://www.superc.ca", parentGroup: "metro_inc" },
  ];

  for (const store of stores) {
    await prisma.storeChain.upsert({
      where: { slug: store.slug },
      update: { nameFr: store.nameFr, nameEn: store.nameEn, website: store.website, parentGroup: store.parentGroup },
      create: store,
    });
  }
  console.log("Seeded", stores.length, "store chains");

  // ── Seed grocery categories ──
  const categories = [
    { slug: "fruits-legumes", nameFr: "Fruits et l\u00e9gumes", nameEn: "Fruits & Vegetables" },
    { slug: "viandes-volailles", nameFr: "Viandes et volailles", nameEn: "Meat & Poultry" },
    { slug: "poissons-fruits-de-mer", nameFr: "Poissons et fruits de mer", nameEn: "Fish & Seafood" },
    { slug: "produits-laitiers", nameFr: "Produits laitiers et oeufs", nameEn: "Dairy & Eggs" },
    { slug: "boulangerie", nameFr: "Boulangerie et p\u00e2tisserie", nameEn: "Bakery" },
    { slug: "cereales-dejeuner", nameFr: "C\u00e9r\u00e9ales et d\u00e9jeuner", nameEn: "Cereal & Breakfast" },
    { slug: "conserves-sauces", nameFr: "Conserves et sauces", nameEn: "Canned Goods & Sauces" },
    { slug: "pates-riz", nameFr: "P\u00e2tes, riz et grains", nameEn: "Pasta, Rice & Grains" },
    { slug: "collations", nameFr: "Collations et biscuits", nameEn: "Snacks & Cookies" },
    { slug: "boissons", nameFr: "Boissons", nameEn: "Beverages" },
    { slug: "surgeles", nameFr: "Surgel\u00e9s", nameEn: "Frozen Foods" },
    { slug: "bio-naturel", nameFr: "Bio et naturel", nameEn: "Organic & Natural" },
    { slug: "bebe", nameFr: "B\u00e9b\u00e9 et enfants", nameEn: "Baby & Kids" },
    { slug: "entretien-menager", nameFr: "Entretien m\u00e9nager", nameEn: "Household Cleaning" },
    { slug: "soins-personnels", nameFr: "Soins personnels", nameEn: "Personal Care" },
    { slug: "epicerie-internationale", nameFr: "\u00c9picerie internationale", nameEn: "International Foods" },
    { slug: "charcuterie-fromages", nameFr: "Charcuterie et fromages", nameEn: "Deli & Cheese" },
    { slug: "pret-a-manger", nameFr: "Pr\u00eat-\u00e0-manger", nameEn: "Ready-to-Eat" },
    { slug: "condiments-epices", nameFr: "Condiments et \u00e9pices", nameEn: "Condiments & Spices" },
    { slug: "huiles-vinaigres", nameFr: "Huiles et vinaigres", nameEn: "Oils & Vinegars" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { nameFr: cat.nameFr, nameEn: cat.nameEn },
      create: cat,
    });
  }
  console.log("Seeded", categories.length, "categories");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
