import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n";

const MAX_BASE64_SIZE = 500 * 1024; // 500KB

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
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
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const body = await request.json();
  const { avatarBase64 } = body;

  if (!avatarBase64 || typeof avatarBase64 !== "string") {
    return NextResponse.json(
      { error: t("api.avatarRequired") },
      { status: 400 }
    );
  }

  if (!avatarBase64.startsWith("data:image/")) {
    return NextResponse.json(
      { error: t("api.invalidImageFormat") },
      { status: 400 }
    );
  }

  if (avatarBase64.length > MAX_BASE64_SIZE) {
    return NextResponse.json(
      { error: t("api.imageTooLarge") },
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
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarBase64: null },
  });

  return NextResponse.json({ avatarBase64: null });
}
