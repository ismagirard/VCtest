import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      lastName: true,
      householdSize: true,
      mealsPerDay: true,
      cookingTimePreference: true,
      budgetPreference: true,
      groceryDay: true,
      groceryFrequency: true,
      province: true,
      city: true,
      preferredStores: true,
    },
  });

  const cookingTimeLabel: Record<string, string> = {
    quick: "quick (under 30 min)",
    moderate: "moderate (30-60 min)",
    elaborate: "elaborate (60+ min)",
  };

  const budgetLabel: Record<string, string> = {
    economic: "economic / savings-focused",
    moderate: "moderate / balanced",
    dontcare: "flexible / time-focused",
  };

  let stores: string[] = [];
  if (user?.preferredStores) {
    try {
      stores = JSON.parse(user.preferredStores);
    } catch {
      // ignore parse errors
    }
  }

  const userContext = user
    ? [
        `User: ${[user.firstName, user.lastName].filter(Boolean).join(" ") || "unknown"}`,
        `Location: ${[user.city, user.province].filter(Boolean).join(", ") || "Quebec, Canada"}`,
        `Household size: ${user.householdSize} person(s)`,
        `Meals per day: ${user.mealsPerDay}`,
        `Cooking time preference: ${cookingTimeLabel[user.cookingTimePreference] || user.cookingTimePreference}`,
        `Budget preference: ${budgetLabel[user.budgetPreference] || user.budgetPreference}`,
        user.groceryDay ? `Grocery shopping day: ${user.groceryDay}` : null,
        `Grocery frequency: ${user.groceryFrequency}`,
        stores.length > 0 ? `Preferred stores: ${stores.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "No user preferences available.";

  const systemPrompt = `You are Foodmi, a friendly and knowledgeable AI grocery planning assistant for Quebec, Canada.
You help users plan their meals, create grocery lists, suggest recipes, and optimize their food budget.

Here is what you know about this user:
${userContext}

Guidelines:
- Be concise and practical. Use short paragraphs and bullet points when listing items.
- When suggesting recipes, consider the user's household size, cooking time preference, and budget.
- When creating grocery lists, organize by store section (produce, dairy, meat, pantry, frozen, etc.).
- You can suggest Quebec-local products and seasonal ingredients when relevant.
- Respond in the same language the user writes in (French or English).
- Use metric measurements (grams, kilograms, litres).
- Be warm and encouraging. Use the user's first name occasionally.
- If the user asks something outside of food/grocery planning, gently redirect them.`;

  const { messages } = await req.json();

  const result = streamText({
    model: google("gemini-2.0-flash"),
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
