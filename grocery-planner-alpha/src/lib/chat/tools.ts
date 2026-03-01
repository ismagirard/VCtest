import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Format product for LLM consumption (compact, relevant fields only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatProduct(p: Record<string, any>, locale: "fr" | "en") {
  const name = locale === "fr" ? p.nameFr : (p.nameEn ?? p.nameFr);
  const store =
    locale === "fr"
      ? p.storeChain?.nameFr
      : (p.storeChain?.nameEn ?? p.storeChain?.nameFr);
  return {
    id: p.id,
    name,
    brand: p.brand ?? null,
    price: p.price,
    salePrice: p.salePrice ?? null,
    pricePerUnit: p.pricePerUnit ?? null,
    unit: p.unit ?? null,
    size: p.size ?? null,
    store,
    storeSlug: p.storeChain?.slug,
    category:
      locale === "fr"
        ? p.category?.nameFr
        : (p.category?.nameEn ?? p.category?.nameFr),
    imageUrl: p.imageUrl ?? null,
    onSale: !!(
      p.salePrice &&
      p.saleEndDate &&
      p.saleEndDate >= new Date()
    ),
  };
}

/**
 * Create LLM tool definitions.
 * User-scoped tools (grocery list ops) throw by default — their execute
 * functions are overridden in the route handler with the authenticated userId.
 */
export function createTools(locale: "fr" | "en", userId: string) {
  return {
    searchProducts: tool({
      description:
        locale === "fr"
          ? "Chercher des produits par nom ou mot-cle dans tous les magasins. Retourne les meilleurs resultats tries par prix."
          : "Search products by name or keyword across all stores. Returns best results sorted by price.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("Search keyword (e.g. 'lait', 'chicken breast', 'beurre')"),
        chain: z
          .string()
          .optional()
          .describe("Filter by store slug: iga, maxi, metro, provigo, superc"),
        onSale: z
          .boolean()
          .optional()
          .describe("Only show products currently on sale"),
        maxResults: z
          .number()
          .optional()
          .default(10)
          .describe("Max results to return (1-20)"),
      }),
      execute: async ({ query, chain, onSale, maxResults }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Record<string, any> = {
          isAvailable: true,
          OR: [
            { nameFr: { contains: query, mode: "insensitive" } },
            { nameEn: { contains: query, mode: "insensitive" } },
            { brand: { contains: query, mode: "insensitive" } },
          ],
        };
        if (chain) where.storeChain = { slug: chain };
        if (onSale) {
          where.salePrice = { not: null };
          where.saleEndDate = { gte: new Date() };
        }

        const products = await prisma.product.findMany({
          where,
          orderBy: { price: "asc" },
          take: Math.min(maxResults ?? 10, 20),
          include: {
            storeChain: { select: { slug: true, nameFr: true, nameEn: true } },
            category: { select: { slug: true, nameFr: true, nameEn: true } },
          },
        });

        return {
          count: products.length,
          products: products.map((p) => formatProduct(p, locale)),
        };
      },
    }),

    findCheapest: tool({
      description:
        locale === "fr"
          ? "Trouver le produit le moins cher pour un article donne, en comparant tous les magasins. Considere les prix en solde."
          : "Find the cheapest product for a given item, comparing across all stores. Considers sale prices.",
      inputSchema: z.object({
        query: z.string().describe("Product to search for"),
        limit: z
          .number()
          .optional()
          .default(5)
          .describe("Number of cheapest options to show"),
      }),
      execute: async ({ query, limit }) => {
        const products = await prisma.product.findMany({
          where: {
            isAvailable: true,
            OR: [
              { nameFr: { contains: query, mode: "insensitive" } },
              { nameEn: { contains: query, mode: "insensitive" } },
              { brand: { contains: query, mode: "insensitive" } },
            ],
          },
          orderBy: { price: "asc" },
          take: Math.min(limit ?? 5, 10),
          include: {
            storeChain: { select: { slug: true, nameFr: true, nameEn: true } },
            category: { select: { slug: true, nameFr: true, nameEn: true } },
          },
        });

        return {
          count: products.length,
          cheapest: products.map((p) => formatProduct(p, locale)),
        };
      },
    }),

    getWeeklySales: tool({
      description:
        locale === "fr"
          ? "Voir les produits en solde cette semaine, optionnellement filtre par magasin ou categorie."
          : "See products on sale this week, optionally filtered by store or category.",
      inputSchema: z.object({
        chain: z
          .string()
          .optional()
          .describe(
            "Store slug to filter: iga, maxi, metro, provigo, superc"
          ),
        category: z
          .string()
          .optional()
          .describe("Category slug to filter"),
        query: z
          .string()
          .optional()
          .describe("Optional keyword to narrow sale results"),
        limit: z.number().optional().default(15).describe("Max results"),
      }),
      execute: async ({ chain, category, query, limit }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Record<string, any> = {
          isAvailable: true,
          salePrice: { not: null },
          saleEndDate: { gte: new Date() },
        };
        if (chain) where.storeChain = { slug: chain };
        if (category) where.category = { slug: category };
        if (query) {
          where.OR = [
            { nameFr: { contains: query, mode: "insensitive" } },
            { nameEn: { contains: query, mode: "insensitive" } },
          ];
        }

        const products = await prisma.product.findMany({
          where,
          orderBy: { salePrice: "asc" },
          take: Math.min(limit ?? 15, 30),
          include: {
            storeChain: { select: { slug: true, nameFr: true, nameEn: true } },
            category: { select: { slug: true, nameFr: true, nameEn: true } },
          },
        });

        return {
          count: products.length,
          sales: products.map((p) => ({
            ...formatProduct(p, locale),
            savings: +(p.price - (p.salePrice ?? p.price)).toFixed(2),
            savingsPercent: Math.round(
              ((p.price - (p.salePrice ?? p.price)) / p.price) * 100
            ),
          })),
        };
      },
    }),

    createGroceryList: tool({
      description:
        locale === "fr"
          ? "Creer une nouvelle liste d'epicerie pour l'utilisateur."
          : "Create a new grocery list for the user.",
      inputSchema: z.object({
        name: z.string().describe("Name for the grocery list"),
      }),
      execute: async ({ name }) => {
        const list = await prisma.groceryList.create({
          data: { userId, name },
        });
        return { listId: list.id, name: list.name, status: list.status };
      },
    }),

    addToGroceryList: tool({
      description:
        locale === "fr"
          ? "Ajouter un ou plusieurs produits a une liste d'epicerie existante."
          : "Add one or more products to an existing grocery list.",
      inputSchema: z.object({
        listId: z.string().describe("ID of the grocery list"),
        items: z
          .array(
            z.object({
              productId: z
                .string()
                .optional()
                .describe("Product ID from search results"),
              customName: z
                .string()
                .optional()
                .describe("Custom item name if not from catalog"),
              quantity: z.number().optional().default(1),
              unit: z.string().optional(),
            })
          )
          .describe("Items to add"),
      }),
      execute: async ({ listId, items }) => {
        // Verify ownership
        const list = await prisma.groceryList.findFirst({
          where: { id: listId, userId },
        });
        if (!list) return { error: "List not found or not yours" };

        const created = await prisma.$transaction(
          items.map((item) =>
            prisma.groceryListItem.create({
              data: {
                groceryListId: listId,
                productId: item.productId || null,
                customName: item.customName || null,
                quantity: item.quantity ?? 1,
                unit: item.unit || null,
              },
            })
          )
        );

        return { added: created.length, listId, listName: list.name };
      },
    }),

    getUserGroceryLists: tool({
      description:
        locale === "fr"
          ? "Voir les listes d'epicerie actives de l'utilisateur."
          : "View the user's active grocery lists.",
      inputSchema: z.object({}),
      execute: async () => {
        const lists = await prisma.groceryList.findMany({
          where: { userId, status: "active" },
          orderBy: { updatedAt: "desc" },
          take: 10,
          include: { _count: { select: { items: true } } },
        });
        return {
          lists: lists.map((l) => ({
            id: l.id,
            name: l.name,
            itemCount: l._count.items,
            updatedAt: l.updatedAt.toISOString(),
          })),
        };
      },
    }),
  };
}
