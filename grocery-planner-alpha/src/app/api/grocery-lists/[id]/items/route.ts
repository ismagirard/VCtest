import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify list ownership
  const list = await prisma.groceryList.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const body = await request.json();
  const { productId, customName, quantity, unit } = body;

  if (!productId && !customName) {
    return NextResponse.json(
      { error: "Either productId or customName is required" },
      { status: 400 }
    );
  }

  // Create the item and record interaction in a transaction
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.groceryListItem.create({
      data: {
        groceryListId: id,
        productId: productId || null,
        customName: customName || null,
        quantity: quantity ?? 1,
        unit: unit || null,
      },
      include: {
        product: {
          select: { id: true, nameFr: true, nameEn: true, imageUrl: true, price: true },
        },
      },
    });

    // Track interaction if it's a catalog product
    if (productId) {
      await tx.userProductInteraction.create({
        data: {
          userId: session.user.id,
          productId,
          action: "added_to_list",
          metadata: JSON.stringify({ quantity: quantity ?? 1, listId: id }),
        },
      });
    }

    return created;
  });

  return NextResponse.json({ item }, { status: 201 });
}
