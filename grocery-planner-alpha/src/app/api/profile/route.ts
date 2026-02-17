import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_COOKING_PREFS = ["quick", "moderate", "elaborate"];
const VALID_BUDGET_PREFS = ["economic", "moderate", "dontcare"];
const VALID_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const VALID_FREQUENCIES = ["weekly", "biweekly", "monthly"];
const VALID_AGENT_MODES = ["auto", "wait", "ask"];

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
      firstName: true,
      lastName: true,
      avatarBase64: true,
      streetAddress: true,
      city: true,
      province: true,
      postalCode: true,
      householdSize: true,
      mealsPerDay: true,
      cookingTimePreference: true,
      preferredStores: true,
      budgetPreference: true,
      groceryDay: true,
      groceryFrequency: true,
      agentMode: true,
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
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

  // Validate cooking time preference
  if (
    body.cookingTimePreference &&
    !VALID_COOKING_PREFS.includes(body.cookingTimePreference)
  ) {
    return NextResponse.json(
      { error: "Invalid cooking time preference" },
      { status: 400 }
    );
  }

  // Validate household size
  if (body.householdSize !== undefined) {
    const size = Number(body.householdSize);
    if (!Number.isInteger(size) || size < 1 || size > 20) {
      return NextResponse.json(
        { error: "Household size must be between 1 and 20" },
        { status: 400 }
      );
    }
  }

  // Validate meals per day
  if (body.mealsPerDay !== undefined) {
    const meals = Number(body.mealsPerDay);
    if (!Number.isInteger(meals) || meals < 1 || meals > 10) {
      return NextResponse.json(
        { error: "Meals per day must be between 1 and 10" },
        { status: 400 }
      );
    }
  }

  // Validate budget preference
  if (
    body.budgetPreference &&
    !VALID_BUDGET_PREFS.includes(body.budgetPreference)
  ) {
    return NextResponse.json(
      { error: "Invalid budget preference" },
      { status: 400 }
    );
  }

  // Validate grocery day
  if (
    body.groceryDay !== undefined &&
    body.groceryDay !== null &&
    !VALID_DAYS.includes(body.groceryDay)
  ) {
    return NextResponse.json(
      { error: "Invalid grocery day" },
      { status: 400 }
    );
  }

  // Validate grocery frequency
  if (
    body.groceryFrequency &&
    !VALID_FREQUENCIES.includes(body.groceryFrequency)
  ) {
    return NextResponse.json(
      { error: "Invalid grocery frequency" },
      { status: 400 }
    );
  }

  // Validate agent mode
  if (body.agentMode && !VALID_AGENT_MODES.includes(body.agentMode)) {
    return NextResponse.json(
      { error: "Invalid agent mode" },
      { status: 400 }
    );
  }

  // Validate notification booleans
  for (const field of ["emailNotifications", "smsNotifications", "pushNotifications"]) {
    if (body[field] !== undefined && typeof body[field] !== "boolean") {
      return NextResponse.json(
        { error: `${field} must be a boolean` },
        { status: 400 }
      );
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      streetAddress: body.streetAddress,
      city: body.city,
      province: body.province,
      postalCode: body.postalCode,
      householdSize: body.householdSize !== undefined
        ? Number(body.householdSize)
        : undefined,
      mealsPerDay: body.mealsPerDay !== undefined
        ? Number(body.mealsPerDay)
        : undefined,
      cookingTimePreference: body.cookingTimePreference,
      preferredStores: body.preferredStores
        ? JSON.stringify(body.preferredStores)
        : undefined,
      budgetPreference: body.budgetPreference,
      groceryDay: body.groceryDay,
      groceryFrequency: body.groceryFrequency,
      agentMode: body.agentMode,
      emailNotifications: body.emailNotifications,
      smsNotifications: body.smsNotifications,
      pushNotifications: body.pushNotifications,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      streetAddress: true,
      city: true,
      province: true,
      postalCode: true,
      householdSize: true,
      mealsPerDay: true,
      cookingTimePreference: true,
      preferredStores: true,
      budgetPreference: true,
      groceryDay: true,
      groceryFrequency: true,
      agentMode: true,
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
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
