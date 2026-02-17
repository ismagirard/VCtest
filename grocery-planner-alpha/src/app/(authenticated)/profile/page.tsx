import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileTabs } from "@/components/profile-tabs";

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
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">Your Profile</h1>
        <ProfileTabs
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
