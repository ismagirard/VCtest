"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Mail, MessageSquare, Bell } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
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

      if (!res.ok) throw new Error(t("notifications.failedSave"));
      toast.success(t("notifications.saved"));
    } catch {
      toast.error(t("notifications.failedSave"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notifications.title")}</CardTitle>
        <CardDescription>
          {t("notifications.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="size-5 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="emailNotif" className="text-sm font-medium">
                {t("notifications.email")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("notifications.emailDesc")}
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
                {t("notifications.sms")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("notifications.smsDesc")}
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
                {t("notifications.push")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("notifications.pushDesc")}
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
