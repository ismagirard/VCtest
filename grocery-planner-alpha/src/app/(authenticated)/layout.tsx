import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <>
      <Nav
        avatarBase64={user?.avatarBase64 ?? null}
        firstName={user?.firstName ?? null}
        lastName={user?.lastName ?? null}
      />
      {children}
    </>
  );
}
