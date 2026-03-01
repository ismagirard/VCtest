import { prisma } from "./lib/db.js";

async function main() {
  // Summary by store
  const stores = await prisma.storeChain.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { slug: "asc" },
  });

  console.log("\n=== Products by Store ===");
  for (const s of stores) {
    console.log(`  ${s.nameFr.padEnd(12)} ${String(s._count.products).padStart(5)} products`);
  }

  // Summary by category (for stores that have products)
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { slug: "asc" },
  });

  console.log("\n=== Products by Category ===");
  for (const c of categories) {
    if (c._count.products > 0) {
      console.log(`  ${c.nameFr.padEnd(30)} ${String(c._count.products).padStart(5)}`);
    }
  }

  // Sample products from Metro
  const metroProducts = await prisma.product.findMany({
    where: { storeChain: { slug: "metro" } },
    include: { storeChain: true, category: true },
    take: 10,
    orderBy: { lastScrapedAt: "desc" },
  });

  console.log("\n=== Sample Metro Products ===");
  for (const p of metroProducts) {
    console.log(`  $${p.price.toFixed(2).padStart(6)} | ${p.nameFr} ${p.size ? `(${p.size})` : ""}`);
  }

  // Sample products from Maxi
  const maxiProducts = await prisma.product.findMany({
    where: { storeChain: { slug: "maxi" } },
    include: { storeChain: true },
    take: 5,
    orderBy: { lastScrapedAt: "desc" },
  });

  console.log("\n=== Sample Maxi Products ===");
  for (const p of maxiProducts) {
    const sale = p.salePrice ? ` (sale: $${p.salePrice.toFixed(2)})` : "";
    console.log(`  $${p.price.toFixed(2).padStart(6)} | ${p.nameFr}${sale}`);
  }

  // Price history count
  const priceHistoryCount = await prisma.priceHistory.count();
  console.log(`\n=== Price History: ${priceHistoryCount} records ===`);

  // Scrape runs
  const scrapeRuns = await prisma.scrapeRun.findMany({
    include: { storeChain: true },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  console.log("\n=== Recent Scrape Runs ===");
  for (const r of scrapeRuns) {
    const dur = r.finishedAt
      ? `${Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000)}s`
      : "running";
    console.log(
      `  ${r.storeChain.slug.padEnd(8)} ${r.status.padEnd(10)} ${String(r.totalProducts).padStart(4)} products (${r.newProducts} new, ${r.updatedProducts} upd) ${dur}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
});
