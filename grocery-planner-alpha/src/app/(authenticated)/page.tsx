import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Chat } from "@/components/chat";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      lastName: true,
      avatarBase64: true,
    },
  });

  return (
    <main className="h-[calc(100vh-57px)]">
      <Chat
        avatarBase64={user?.avatarBase64 ?? null}
        firstName={user?.firstName ?? null}
        lastName={user?.lastName ?? null}
      />
    </main>
  );
}
