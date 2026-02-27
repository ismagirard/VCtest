"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Clock, Bot } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { ProfileData } from "./profile-tabs";

const BUDGET_OPTIONS = [
  {
    value: "economic",
    label: t("preferences.budgetEconomic"),
    description: t("preferences.budgetEconomicDesc"),
    icon: "\u{1F4B0}",
  },
  {
    value: "moderate",
    label: t("preferences.budgetModerate"),
    description: t("preferences.budgetModerateDesc"),
    icon: "\u2696\uFE0F",
  },
  {
    value: "dontcare",
    label: t("preferences.budgetDontCare"),
    description: t("preferences.budgetDontCareDesc"),
    icon: "\u23F1\uFE0F",
  },
];

const AGENT_MODE_OPTIONS = [
  {
    value: "auto",
    label: t("preferences.agentAuto"),
    description: t("preferences.agentAutoDesc"),
    icon: "\u{1F916}",
  },
  {
    value: "wait",
    label: t("preferences.agentWait"),
    description: t("preferences.agentWaitDesc"),
    icon: "\u{1F4AC}",
  },
  {
    value: "ask",
    label: t("preferences.agentAsk"),
    description: t("preferences.agentAskDesc"),
    icon: "\u2753",
  },
];

const DAYS = [
  { value: "none", label: t("days.none") },
  { value: "monday", label: t("days.monday") },
  { value: "tuesday", label: t("days.tuesday") },
  { value: "wednesday", label: t("days.wednesday") },
  { value: "thursday", label: t("days.thursday") },
  { value: "friday", label: t("days.friday") },
  { value: "saturday", label: t("days.saturday") },
  { value: "sunday", label: t("days.sunday") },
];

function CardSelector({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; description: string; icon: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
            value === option.value
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted"
          }`}
        >
          <span className="text-xl mt-0.5">{option.icon}</span>
          <div>
            <div className="font-medium text-sm">{option.label}</div>
            <div className="text-xs text-muted-foreground">{option.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function PreferencesTab({ initialData }: { initialData: ProfileData }) {
  // Track as strings to fix the number input bug
  const [householdSizeStr, setHouseholdSizeStr] = useState(
    String(initialData.householdSize)
  );
  const [mealsPerDayStr, setMealsPerDayStr] = useState(
    String(initialData.mealsPerDay)
  );
  const [cookingTimePreference, setCookingTimePreference] = useState(
    initialData.cookingTimePreference
  );
  const [budgetPreference, setBudgetPreference] = useState(
    initialData.budgetPreference
  );
  const [groceryDay, setGroceryDay] = useState(initialData.groceryDay ?? "none");
  const [groceryFrequency, setGroceryFrequency] = useState(
    initialData.groceryFrequency
  );
  const [agentMode, setAgentMode] = useState(initialData.agentMode);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // Validate numbers on save
    const householdSize = parseInt(householdSizeStr);
    if (isNaN(householdSize) || householdSize < 1 || householdSize > 20) {
      toast.error(t("preferences.householdSizeError"));
      return;
    }

    const mealsPerDay = parseInt(mealsPerDayStr);
    if (isNaN(mealsPerDay) || mealsPerDay < 1 || mealsPerDay > 10) {
      toast.error(t("preferences.mealsPerDayError"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdSize,
          mealsPerDay,
          cookingTimePreference,
          budgetPreference,
          groceryDay: groceryDay === "none" ? null : groceryDay,
          groceryFrequency,
          agentMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("preferences.failedSave"));
      }

      toast.success(t("preferences.preferencesUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("preferences.failedSave"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cooking Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            {t("preferences.cookingTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="householdSize">{t("preferences.householdSize")}</Label>
              <Input
                id="householdSize"
                inputMode="numeric"
                pattern="[0-9]*"
                value={householdSizeStr}
                onChange={(e) => setHouseholdSizeStr(e.target.value)}
                placeholder="1-20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mealsPerDay">{t("preferences.mealsPerDay")}</Label>
              <Input
                id="mealsPerDay"
                inputMode="numeric"
                pattern="[0-9]*"
                value={mealsPerDayStr}
                onChange={(e) => setMealsPerDayStr(e.target.value)}
                placeholder="1-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cookingTime">{t("preferences.cookingTime")}</Label>
            <Select value={cookingTimePreference} onValueChange={setCookingTimePreference}>
              <SelectTrigger id="cookingTime">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quick">{t("preferences.cookingQuick")}</SelectItem>
                <SelectItem value="moderate">{t("preferences.cookingModerate")}</SelectItem>
                <SelectItem value="elaborate">{t("preferences.cookingElaborate")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Budget Preference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-5" />
            {t("preferences.budgetTitle")}
          </CardTitle>
          <CardDescription>
            {t("preferences.budgetDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CardSelector
            options={BUDGET_OPTIONS}
            value={budgetPreference}
            onChange={setBudgetPreference}
          />
        </CardContent>
      </Card>

      {/* Grocery Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-5" />
            {t("preferences.agentTitle")}
          </CardTitle>
          <CardDescription>
            {t("preferences.agentDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="groceryDay">{t("preferences.shoppingDay")}</Label>
              <Select value={groceryDay} onValueChange={setGroceryDay}>
                <SelectTrigger id="groceryDay">
                  <SelectValue placeholder={t("preferences.selectDay")} />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="groceryFrequency">{t("preferences.howOften")}</Label>
              <Select value={groceryFrequency} onValueChange={setGroceryFrequency}>
                <SelectTrigger id="groceryFrequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t("preferences.weekly")}</SelectItem>
                  <SelectItem value="biweekly">{t("preferences.biweekly")}</SelectItem>
                  <SelectItem value="monthly">{t("preferences.monthly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t("preferences.agentBehavior")}</Label>
            <CardSelector
              options={AGENT_MODE_OPTIONS}
              value={agentMode}
              onChange={setAgentMode}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? t("preferences.saving") : t("preferences.savePreferences")}
      </Button>
    </div>
  );
}
