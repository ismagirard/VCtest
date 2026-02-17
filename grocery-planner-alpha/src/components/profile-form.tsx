"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  householdSize: number;
  mealsPerDay: number;
  cookingTimePreference: string;
  location: string | null;
  preferredStores: string[];
}

export function ProfileForm({ initialData }: { initialData: ProfileData }) {
  const [formData, setFormData] = useState({
    name: initialData.name ?? "",
    householdSize: initialData.householdSize,
    mealsPerDay: initialData.mealsPerDay,
    cookingTimePreference: initialData.cookingTimePreference,
    location: initialData.location ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setMessage("Profile updated successfully");
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to update profile");
      }
    } catch {
      setMessage("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            {initialData.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Postal Code (Quebec)</Label>
            <Input
              id="location"
              placeholder="H2X 1Y4"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="householdSize">Household Size</Label>
            <Input
              id="householdSize"
              type="number"
              min={1}
              max={20}
              value={formData.householdSize}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  householdSize: parseInt(e.target.value) || 1,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mealsPerDay">Meals Per Day</Label>
            <Input
              id="mealsPerDay"
              type="number"
              min={1}
              max={10}
              value={formData.mealsPerDay}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  mealsPerDay: parseInt(e.target.value) || 3,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cookingTime">Cooking Time Preference</Label>
            <Select
              value={formData.cookingTimePreference}
              onValueChange={(value) =>
                setFormData({ ...formData, cookingTimePreference: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quick">Quick (under 30 min)</SelectItem>
                <SelectItem value="moderate">Moderate (30-60 min)</SelectItem>
                <SelectItem value="elaborate">Elaborate (60+ min)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {message && (
            <p
              className={`text-sm ${
                message.includes("successfully")
                  ? "text-green-600"
                  : "text-red-500"
              }`}
            >
              {message}
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
