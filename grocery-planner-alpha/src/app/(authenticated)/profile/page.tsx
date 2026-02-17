import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
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
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">Your Profile</h1>
        <ProfileForm
          initialData={{
            ...user,
            preferredStores: user.preferredStores
              ? JSON.parse(user.preferredStores)
              : [],
          }}
        />
      </div>
    </div>
  );
}
