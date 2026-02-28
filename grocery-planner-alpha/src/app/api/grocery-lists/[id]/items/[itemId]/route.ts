import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, itemId } = await params;

  // Verify list ownership
  const list = await prisma.groceryList.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: { quantity?: number; isChecked?: boolean; unit?: string } = {};

  if (typeof body.quantity === "number") data.quantity = body.quantity;
  if (typeof body.isChecked === "boolean") data.isChecked = body.isChecked;
  if (body.unit !== undefined) data.unit = body.unit;

  const item = await prisma.groceryListItem.update({
    where: { id: itemId },
    data,
  });

  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, itemId } = await params;

  // Verify list ownership
  const list = await prisma.groceryList.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  // Track removal interaction if it's a catalog product
  const item = await prisma.groceryListItem.findUnique({ where: { id: itemId } });
  if (item?.productId) {
    await prisma.userProductInteraction.create({
      data: {
        userId: session.user.id,
        productId: item.productId,
        action: "removed",
        metadata: JSON.stringify({ listId: id }),
      },
    });
  }

  await prisma.groceryListItem.delete({ where: { id: itemId } });

  return NextResponse.json({ success: true });
}
