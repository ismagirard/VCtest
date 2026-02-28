import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lists = await prisma.groceryList.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { items: true } },
      items: {
        take: 5,
        orderBy: { addedAt: "desc" },
        include: { product: { select: { nameFr: true, nameEn: true, imageUrl: true } } },
      },
    },
  });

  return NextResponse.json({ lists });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = body.name ?? "Ma liste";

  const list = await prisma.groceryList.create({
    data: { userId: session.user.id, name },
  });

  return NextResponse.json({ list }, { status: 201 });
}
