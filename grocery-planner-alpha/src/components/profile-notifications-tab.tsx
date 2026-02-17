"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Mail, MessageSquare, Bell } from "lucide-react";
import { toast } from "sonner";
import type { ProfileData } from "./profile-tabs";

export function NotificationsTab({ initialData }: { initialData: ProfileData }) {
  const [emailNotifications, setEmailNotifications] = useState(
    initialData.emailNotifications
  );
  const [smsNotifications, setSmsNotifications] = useState(
    initialData.smsNotifications
  );
  const [pushNotifications, setPushNotifications] = useState(
    initialData.pushNotifications
  );

  const saveNotification = async (field: string, value: boolean) => {
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (!res.ok) throw new Error("Failed to save");
      toast.success("Notification preference saved");
    } catch {
      toast.error("Failed to update notification preference");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Choose how you want to be notified about grocery plans and reminders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="size-5 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="emailNotif" className="text-sm font-medium">
                Email Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive grocery lists and reminders via email
              </p>
            </div>
          </div>
          <Switch
            id="emailNotif"
            checked={emailNotifications}
            onCheckedChange={(checked) => {
              setEmailNotifications(checked);
              saveNotification("emailNotifications", checked);
            }}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="size-5 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="smsNotif" className="text-sm font-medium">
                SMS Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Get text messages with shopping reminders
              </p>
            </div>
          </div>
          <Switch
            id="smsNotif"
            checked={smsNotifications}
            onCheckedChange={(checked) => {
              setSmsNotifications(checked);
              saveNotification("smsNotifications", checked);
            }}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="size-5 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="pushNotif" className="text-sm font-medium">
                Push Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive browser push notifications for updates
              </p>
            </div>
          </div>
          <Switch
            id="pushNotif"
            checked={pushNotifications}
            onCheckedChange={(checked) => {
              setPushNotifications(checked);
              saveNotification("pushNotifications", checked);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
