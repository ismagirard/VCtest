import { prisma } from "./lib/db.js";
import { log } from "./lib/logger.js";
import { StoreAdapter } from "./stores/base-store.js";
import { MaxiAdapter } from "./stores/maxi.js";
import type { ScrapedProduct, ScrapeProgress } from "./types.js";

// ── Registry of available store adapters ──

const ADAPTERS: Record<string, () => StoreAdapter> = {
  maxi: () => new MaxiAdapter(),
};

// ── Scrape runner ──

async function runScrape(adapter: StoreAdapter, limit?: number) {
  const storeChain = await prisma.storeChain.findUnique({
    where: { slug: adapter.chainSlug },
  });
  if (!storeChain) {
    throw new Error(`Store chain "${adapter.chainSlug}" not found in DB. Run prisma db seed first.`);
  }

  // Create a scrape run record
  const scrapeRun = await prisma.scrapeRun.create({
    data: { storeChainId: storeChain.id, status: "running" },
  });

  const progress: ScrapeProgress = {
    totalProducts: 0,
    newProducts: 0,
    updatedProducts: 0,
    errors: 0,
  };

  try {
    log.info(`Fetching categories for ${adapter.chainNameFr}...`);
    const categories = await adapter.fetchCategories();
    log.info(`Found ${categories.length} categories`);

    for (const cat of categories) {
      if (limit && progress.totalProducts >= limit) {
        log.info(`Reached limit of ${limit} products, stopping.`);
        break;
      }

      progress.currentCategory = cat.slug;
      log.info(`Scraping category: ${cat.nameFr} (${cat.slug})`);

      // Ensure category exists in DB
      const dbCategory = await prisma.category.upsert({
        where: { slug: cat.slug },
        update: { nameFr: cat.nameFr, nameEn: cat.nameEn ?? cat.nameFr },
        create: { slug: cat.slug, nameFr: cat.nameFr, nameEn: cat.nameEn ?? cat.nameFr },
      });

      let page = 0;
      while (true) {
        if (limit && progress.totalProducts >= limit) break;

        const products = await adapter.fetchProductPage(cat.slug, page);
        if (!products || products.length === 0) break;

        progress.currentPage = page;
        const remaining = limit ? limit - progress.totalProducts : products.length;
        const batch = products.slice(0, remaining);

        await upsertProducts(batch, storeChain.id, dbCategory.id, progress);

        log.progress(progress.totalProducts, limit ?? 0, `products (${progress.newProducts} new, ${progress.updatedProducts} updated)`);

        // Update scrape run progress
        await prisma.scrapeRun.update({
          where: { id: scrapeRun.id },
          data: {
            totalProducts: progress.totalProducts,
            newProducts: progress.newProducts,
            updatedProducts: progress.updatedProducts,
            errors: progress.errors,
            lastCategorySlug: cat.slug,
            lastPage: page,
          },
        });

        page++;
      }
    }

    // Mark as completed
    await prisma.scrapeRun.update({
      where: { id: scrapeRun.id },
      data: {
        status: "completed",
        finishedAt: new Date(),
        totalProducts: progress.totalProducts,
        newProducts: progress.newProducts,
        updatedProducts: progress.updatedProducts,
        errors: progress.errors,
      },
    });

    log.info(`Scrape completed: ${progress.totalProducts} total, ${progress.newProducts} new, ${progress.updatedProducts} updated, ${progress.errors} errors`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error(`Scrape failed: ${errorMsg}`);

    await prisma.scrapeRun.update({
      where: { id: scrapeRun.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        totalProducts: progress.totalProducts,
        newProducts: progress.newProducts,
        updatedProducts: progress.updatedProducts,
        errors: progress.errors,
        errorLog: errorMsg,
      },
    });

    throw err;
  }
}

async function upsertProducts(
  products: ScrapedProduct[],
  storeChainId: string,
  categoryId: string,
  progress: ScrapeProgress
) {
  for (const p of products) {
    try {
      const existing = await prisma.product.findUnique({
        where: { storeChainId_externalId: { storeChainId, externalId: p.externalId } },
      });

      const now = new Date();

      if (existing) {
        // Update product
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            nameFr: p.nameFr,
            nameEn: p.nameEn,
            brand: p.brand,
            description: p.description,
            imageUrl: p.imageUrl,
            price: p.price,
            pricePerUnit: p.pricePerUnit,
            unit: p.unit,
            size: p.size,
            salePrice: p.salePrice,
            saleStartDate: p.saleStartDate,
            saleEndDate: p.saleEndDate,
            sku: p.sku,
            upc: p.upc,
            isAvailable: true,
            lastScrapedAt: now,
            categoryId,
          },
        });

        // Record price change if different
        if (existing.price !== p.price || existing.salePrice !== p.salePrice) {
          await prisma.priceHistory.create({
            data: { productId: existing.id, price: p.price, salePrice: p.salePrice },
          });
        }

        progress.updatedProducts++;
      } else {
        // Create new product
        const created = await prisma.product.create({
          data: {
            externalId: p.externalId,
            storeChainId,
            categoryId,
            nameFr: p.nameFr,
            nameEn: p.nameEn,
            brand: p.brand,
            description: p.description,
            imageUrl: p.imageUrl,
            price: p.price,
            pricePerUnit: p.pricePerUnit,
            unit: p.unit,
            size: p.size,
            salePrice: p.salePrice,
            saleStartDate: p.saleStartDate,
            saleEndDate: p.saleEndDate,
            sku: p.sku,
            upc: p.upc,
            lastScrapedAt: now,
          },
        });

        // Initial price history record
        await prisma.priceHistory.create({
          data: { productId: created.id, price: p.price, salePrice: p.salePrice },
        });

        progress.newProducts++;
      }

      progress.totalProducts++;
    } catch (err) {
      progress.errors++;
      log.error(`Failed to upsert product ${p.externalId}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

// ── CLI ──

async function main() {
  const args = process.argv.slice(2);
  const storeArg = args.find((a) => a.startsWith("--store="))?.split("=")[1] ?? "maxi";
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const limit = limitArg ? parseInt(limitArg) : undefined;

  log.info(`Foodmi Scraper — store: ${storeArg}, limit: ${limit ?? "none"}`);

  const storeKeys = storeArg === "all" ? Object.keys(ADAPTERS) : [storeArg];

  for (const key of storeKeys) {
    const factory = ADAPTERS[key];
    if (!factory) {
      log.error(`Unknown store: ${key}. Available: ${Object.keys(ADAPTERS).join(", ")}`);
      process.exit(1);
    }

    const adapter = factory();
    log.info(`Starting scrape for ${adapter.chainNameFr}...`);
    await runScrape(adapter, limit);
  }

  await prisma.$disconnect();
  log.info("Done.");
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
