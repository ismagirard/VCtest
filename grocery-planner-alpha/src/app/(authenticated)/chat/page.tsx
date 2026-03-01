import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChatInterface } from "@/components/chat/chat-interface";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Load recent conversations for sidebar
  const conversations = await prisma.chatConversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, title: true, updatedAt: true },
  });

  // Serialize dates for client component
  const serialized = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return <ChatInterface initialConversations={serialized} />;
}
