import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">Grocery Planner</h1>
      <p className="text-muted-foreground">
        Welcome, {session.user.name ?? session.user.email}
      </p>
    </main>
  );
}
