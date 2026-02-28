import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the latest scrape run per store chain
  const storeChains = await prisma.storeChain.findMany({
    include: {
      scrapeRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
      _count: { select: { products: true } },
    },
  });

  const status = storeChains.map((chain) => ({
    slug: chain.slug,
    nameFr: chain.nameFr,
    nameEn: chain.nameEn,
    productCount: chain._count.products,
    lastScrape: chain.scrapeRuns[0] ?? null,
  }));

  return NextResponse.json({ status });
}
