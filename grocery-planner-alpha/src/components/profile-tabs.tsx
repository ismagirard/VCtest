"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountTab } from "./profile-account-tab";
import { PreferencesTab } from "./profile-preferences-tab";
import { NotificationsTab } from "./profile-notifications-tab";
import { User, Settings, Bell } from "lucide-react";

export interface ProfileData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarBase64: string | null;
  streetAddress: string | null;
  city: string | null;
  province: string;
  postalCode: string | null;
  householdSize: number;
  mealsPerDay: number;
  cookingTimePreference: string;
  preferredStores: string[];
  budgetPreference: string;
  groceryDay: string | null;
  groceryFrequency: string;
  agentMode: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
}

export function ProfileTabs({ initialData }: { initialData: ProfileData }) {
  return (
    <Tabs defaultValue="account" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="account" className="flex items-center gap-2">
          <User className="size-4" />
          Account
        </TabsTrigger>
        <TabsTrigger value="preferences" className="flex items-center gap-2">
          <Settings className="size-4" />
          Preferences
        </TabsTrigger>
        <TabsTrigger value="notifications" className="flex items-center gap-2">
          <Bell className="size-4" />
          Notifications
        </TabsTrigger>
      </TabsList>
      <TabsContent value="account" className="mt-6">
        <AccountTab initialData={initialData} />
      </TabsContent>
      <TabsContent value="preferences" className="mt-6">
        <PreferencesTab initialData={initialData} />
      </TabsContent>
      <TabsContent value="notifications" className="mt-6">
        <NotificationsTab initialData={initialData} />
      </TabsContent>
    </Tabs>
  );
}
