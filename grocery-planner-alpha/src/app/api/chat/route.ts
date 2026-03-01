import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultModel } from "@/lib/openrouter";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { createTools } from "@/lib/chat/tools";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const messages = body.messages as UIMessage[];
  const conversationId = body.conversationId as string | undefined;

  // Get locale from cookie
  const cookieStore = await cookies();
  const locale = (
    cookieStore.get("locale")?.value === "en" ? "en" : "fr"
  ) as "fr" | "en";

  // Load user preferences for system prompt
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      firstName: true,
      householdSize: true,
      mealsPerDay: true,
      cookingTimePreference: true,
      budgetPreference: true,
      preferredStores: true,
      groceryDay: true,
      groceryFrequency: true,
      agentMode: true,
    },
  });

  const system = buildSystemPrompt({
    user,
    locale,
    today: new Date().toISOString().split("T")[0],
  });

  // Create tools with authenticated userId baked in
  const tools = createTools(locale, userId);

  // Determine or create conversation
  let convId = conversationId;
  if (!convId) {
    // Extract title from first user message
    const firstUserMsg = messages.find((m) => m.role === "user");
    const title =
      firstUserMsg?.parts
        ?.filter(
          (p): p is { type: "text"; text: string } => p.type === "text"
        )
        ?.map((p) => p.text)
        ?.join(" ")
        ?.slice(0, 100) ??
      (locale === "fr" ? "Nouvelle conversation" : "New conversation");

    const conv = await prisma.chatConversation.create({
      data: { userId, title },
    });
    convId = conv.id;
  }

  // Save user message to DB
  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg?.role === "user") {
    await prisma.chatMessage.create({
      data: {
        conversationId: convId,
        role: "user",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parts: lastUserMsg.parts as unknown as Record<string, any>,
      },
    });
  }

  const result = streamText({
    model: defaultModel,
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5), // Allow up to 5 tool-call rounds
    onFinish: async ({ response }) => {
      // Save assistant messages to DB after streaming completes
      try {
        const assistantMessages = response.messages.filter(
          (m) => m.role === "assistant"
        );
        for (const msg of assistantMessages) {
          await prisma.chatMessage.create({
            data: {
              conversationId: convId!,
              role: "assistant",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              parts: msg.content as unknown as Record<string, any>,
            },
          });
        }
        // Touch conversation updatedAt
        await prisma.chatConversation.update({
          where: { id: convId! },
          data: { updatedAt: new Date() },
        });
      } catch (err) {
        console.error("Failed to save assistant message:", err);
      }
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      "X-Conversation-Id": convId,
    },
  });
}
