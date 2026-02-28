import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const chain = searchParams.get("chain");
  const category = searchParams.get("category");
  const onSale = searchParams.get("onSale") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const sort = searchParams.get("sort") ?? "name";

  const where: Prisma.ProductWhereInput = {};

  // Text search
  if (q.length >= 2) {
    where.OR = [
      { nameFr: { contains: q, mode: "insensitive" } },
      { nameEn: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
    ];
  }

  // Store chain filter
  if (chain) {
    where.storeChain = { slug: chain };
  }

  // Category filter
  if (category) {
    where.category = { slug: category };
  }

  // On sale filter
  if (onSale) {
    where.salePrice = { not: null };
    where.saleEndDate = { gte: new Date() };
  }

  // Sort
  let orderBy: Prisma.ProductOrderByWithRelationInput;
  switch (sort) {
    case "price_asc":
      orderBy = { price: "asc" };
      break;
    case "price_desc":
      orderBy = { price: "desc" };
      break;
    default:
      orderBy = { nameFr: "asc" };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        storeChain: { select: { slug: true, nameFr: true, nameEn: true } },
        category: { select: { slug: true, nameFr: true, nameEn: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({
    products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
