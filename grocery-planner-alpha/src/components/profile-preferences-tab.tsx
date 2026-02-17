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
import type { ProfileData } from "./profile-tabs";

const BUDGET_OPTIONS = [
  {
    value: "economic",
    label: "Economic",
    description: "Focused on savings",
    icon: "💰",
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "Balance of time and savings",
    icon: "⚖️",
  },
  {
    value: "dontcare",
    label: "Don't care",
    description: "Focused only on time",
    icon: "⏱️",
  },
];

const AGENT_MODE_OPTIONS = [
  {
    value: "auto",
    label: "Plan before grocery",
    description: "Agent proactively creates your grocery list before your shopping day",
    icon: "🤖",
  },
  {
    value: "wait",
    label: "Wait for me to chat",
    description: "Agent only acts when you start a conversation",
    icon: "💬",
  },
  {
    value: "ask",
    label: "Ask questions first",
    description: "Agent asks your preferences before creating a plan",
    icon: "❓",
  },
];

const DAYS = [
  { value: "none", label: "No preference" },
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
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
      toast.error("Household size must be between 1 and 20");
      return;
    }

    const mealsPerDay = parseInt(mealsPerDayStr);
    if (isNaN(mealsPerDay) || mealsPerDay < 1 || mealsPerDay > 10) {
      toast.error("Meals per day must be between 1 and 10");
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
        throw new Error(data.error || "Failed to save");
      }

      toast.success("Preferences updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
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
            Cooking Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="householdSize">Household Size</Label>
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
              <Label htmlFor="mealsPerDay">Meals Per Day</Label>
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
            <Label htmlFor="cookingTime">Cooking Time Preference</Label>
            <Select value={cookingTimePreference} onValueChange={setCookingTimePreference}>
              <SelectTrigger id="cookingTime">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quick">Quick (under 30 min)</SelectItem>
                <SelectItem value="moderate">Moderate (30-60 min)</SelectItem>
                <SelectItem value="elaborate">Elaborate (60+ min)</SelectItem>
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
            Budget Preference
          </CardTitle>
          <CardDescription>
            How should the AI prioritize your grocery planning?
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
            Grocery Agent
          </CardTitle>
          <CardDescription>
            Configure how and when the AI assistant helps you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="groceryDay">Shopping Day</Label>
              <Select value={groceryDay} onValueChange={setGroceryDay}>
                <SelectTrigger id="groceryDay">
                  <SelectValue placeholder="Select a day" />
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
              <Label htmlFor="groceryFrequency">How Often</Label>
              <Select value={groceryFrequency} onValueChange={setGroceryFrequency}>
                <SelectTrigger id="groceryFrequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Agent Behavior</Label>
            <CardSelector
              options={AGENT_MODE_OPTIONS}
              value={agentMode}
              onChange={setAgentMode}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Preferences"}
      </Button>
    </div>
  );
}
