import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const list = await prisma.groceryList.findFirst({
    where: { id, userId: session.user.id },
    include: {
      items: {
        orderBy: { addedAt: "asc" },
        include: {
          product: {
            select: {
              id: true, nameFr: true, nameEn: true, brand: true,
              price: true, salePrice: true, imageUrl: true, size: true,
              storeChain: { select: { slug: true, nameFr: true } },
            },
          },
        },
      },
    },
  });

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  return NextResponse.json({ list });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Verify ownership
  const existing = await prisma.groceryList.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const data: { name?: string; status?: string } = {};
  if (body.name) data.name = body.name;
  if (body.status && ["active", "completed", "archived"].includes(body.status)) {
    data.status = body.status;

    // When completing a list, record "purchased" interactions for all checked items
    if (body.status === "completed") {
      const checkedItems = await prisma.groceryListItem.findMany({
        where: { groceryListId: id, isChecked: true, productId: { not: null } },
      });
      if (checkedItems.length > 0) {
        await prisma.userProductInteraction.createMany({
          data: checkedItems.map((item) => ({
            userId: session.user.id,
            productId: item.productId!,
            action: "purchased",
            metadata: JSON.stringify({ quantity: item.quantity, listId: id }),
          })),
        });
      }
    }
  }

  const list = await prisma.groceryList.update({
    where: { id },
    data,
  });

  return NextResponse.json({ list });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.groceryList.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  await prisma.groceryList.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
