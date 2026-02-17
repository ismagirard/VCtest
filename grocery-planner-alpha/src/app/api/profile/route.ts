import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      householdSize: true,
      mealsPerDay: true,
      cookingTimePreference: true,
      location: true,
      preferredStores: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    preferredStores: user.preferredStores
      ? JSON.parse(user.preferredStores)
      : [],
  });
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const validPreferences = ["quick", "moderate", "elaborate"];
  if (
    body.cookingTimePreference &&
    !validPreferences.includes(body.cookingTimePreference)
  ) {
    return NextResponse.json(
      { error: "Invalid cooking time preference" },
      { status: 400 }
    );
  }

  if (body.householdSize !== undefined) {
    const size = Number(body.householdSize);
    if (!Number.isInteger(size) || size < 1 || size > 20) {
      return NextResponse.json(
        { error: "Household size must be between 1 and 20" },
        { status: 400 }
      );
    }
  }

  if (body.mealsPerDay !== undefined) {
    const meals = Number(body.mealsPerDay);
    if (!Number.isInteger(meals) || meals < 1 || meals > 10) {
      return NextResponse.json(
        { error: "Meals per day must be between 1 and 10" },
        { status: 400 }
      );
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: body.name,
      householdSize: body.householdSize
        ? Number(body.householdSize)
        : undefined,
      mealsPerDay: body.mealsPerDay ? Number(body.mealsPerDay) : undefined,
      cookingTimePreference: body.cookingTimePreference,
      location: body.location,
      preferredStores: body.preferredStores
        ? JSON.stringify(body.preferredStores)
        : undefined,
    },
    select: {
      id: true,
      email: true,
      name: true,
      householdSize: true,
      mealsPerDay: true,
      cookingTimePreference: true,
      location: true,
      preferredStores: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    ...updatedUser,
    preferredStores: updatedUser.preferredStores
      ? JSON.parse(updatedUser.preferredStores)
      : [],
  });
}
