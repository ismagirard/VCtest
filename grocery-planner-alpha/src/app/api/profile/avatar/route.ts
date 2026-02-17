import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_BASE64_SIZE = 500 * 1024; // 500KB

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarBase64: true },
  });

  return NextResponse.json({ avatarBase64: user?.avatarBase64 ?? null });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { avatarBase64 } = body;

  if (!avatarBase64 || typeof avatarBase64 !== "string") {
    return NextResponse.json(
      { error: "avatarBase64 is required" },
      { status: 400 }
    );
  }

  if (!avatarBase64.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Invalid image format" },
      { status: 400 }
    );
  }

  if (avatarBase64.length > MAX_BASE64_SIZE) {
    return NextResponse.json(
      { error: "Image too large (max 500KB)" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarBase64 },
  });

  return NextResponse.json({ avatarBase64 });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarBase64: null },
  });

  return NextResponse.json({ avatarBase64: null });
}
