"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { ProfileData } from "./profile-tabs";

const PROVINCES = [
  { value: "AB", label: t("provinces.AB") },
  { value: "BC", label: t("provinces.BC") },
  { value: "MB", label: t("provinces.MB") },
  { value: "NB", label: t("provinces.NB") },
  { value: "NL", label: t("provinces.NL") },
  { value: "NS", label: t("provinces.NS") },
  { value: "NT", label: t("provinces.NT") },
  { value: "NU", label: t("provinces.NU") },
  { value: "ON", label: t("provinces.ON") },
  { value: "PE", label: t("provinces.PE") },
  { value: "QC", label: t("provinces.QC") },
  { value: "SK", label: t("provinces.SK") },
  { value: "YT", label: t("provinces.YT") },
];

interface AddressSuggestion {
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  formatted: string;
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const f = firstName?.[0]?.toUpperCase() || "";
  const l = lastName?.[0]?.toUpperCase() || "";
  return f + l || "?";
}

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));

        // Crop to square from center
        const size = Math.min(img.width, img.height);
        const x = (img.width - size) / 2;
        const y = (img.height - size) / 2;
        ctx.drawImage(img, x, y, size, size, 0, 0, maxSize, maxSize);

        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function AccountTab({ initialData }: { initialData: ProfileData }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [avatar, setAvatar] = useState(initialData.avatarBase64);
  const [firstName, setFirstName] = useState(initialData.firstName ?? "");
  const [lastName, setLastName] = useState(initialData.lastName ?? "");
  const [email, setEmail] = useState(initialData.email);
  const [streetAddress, setStreetAddress] = useState(initialData.streetAddress ?? "");
  const [city, setCity] = useState(initialData.city ?? "");
  const [province, setProvince] = useState(initialData.province);
  const [postalCode, setPostalCode] = useState(initialData.postalCode ?? "");
  const [saving, setSaving] = useState(false);

  // Address autocomplete
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Password dialog
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("account.selectImageFile"));
      return;
    }

    try {
      const base64 = await resizeImage(file, 200);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarBase64: base64 }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("account.failedUploadPhoto"));
      }

      setAvatar(base64);
      toast.success(t("account.photoUpdated"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("account.failedUploadPhoto"));
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAvatarRemove = async () => {
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error(t("account.failedRemovePhoto"));
      setAvatar(null);
      toast.success(t("account.photoRemoved"));
      router.refresh();
    } catch {
      toast.error(t("account.failedRemovePhoto"));
    }
  };

  const handleAddressSearch = useCallback((query: string) => {
    setStreetAddress(query);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-autocomplete?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.results?.length > 0) {
          setSuggestions(data.results);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  }, []);

  const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
    setStreetAddress(suggestion.streetAddress);
    setCity(suggestion.city);
    setProvince(suggestion.province);
    setPostalCode(suggestion.postalCode);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName || null,
          lastName: lastName || null,
          email,
          streetAddress: streetAddress || null,
          city: city || null,
          province,
          postalCode: postalCode || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("account.failedSave"));
      }

      toast.success(t("account.accountUpdated"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("account.failedSave"));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t("account.passwordsDontMatch"));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t("account.passwordMinLength"));
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("account.failedChangePassword"));
      }

      toast.success(t("account.passwordChanged"));
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("account.failedChangePassword"));
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("account.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar className="size-20">
            <AvatarImage src={avatar ?? undefined} alt={t("nav.avatarAlt")} />
            <AvatarFallback className="text-lg">
              {getInitials(firstName, lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="size-4 mr-2" />
              {t("account.changePhoto")}
            </Button>
            {avatar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAvatarRemove}
                className="text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                {t("account.remove")}
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t("account.firstName")}</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t("account.firstNamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t("account.lastName")}</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t("account.lastNamePlaceholder")}
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">{t("account.email")}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label>{t("account.password")}</Label>
          <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Lock className="size-4 mr-2" />
                {t("account.changePassword")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("account.changePassword")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">{t("account.currentPassword")}</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t("account.newPassword")}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("account.newPasswordPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("account.confirmPassword")}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handlePasswordChange}
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full"
                >
                  {changingPassword ? t("account.changingPassword") : t("account.updatePassword")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Separator />

        {/* Address */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">{t("account.address")}</h3>
          <div className="relative space-y-2">
            <Label htmlFor="streetAddress">{t("account.streetAddress")}</Label>
            <Input
              id="streetAddress"
              value={streetAddress}
              onChange={(e) => handleAddressSearch(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={t("account.streetAddressPlaceholder")}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                    onMouseDown={() => handleSuggestionSelect(s)}
                  >
                    {s.formatted}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">{t("account.city")}</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("account.cityPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="province">{t("account.province")}</Label>
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger id="province">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2 max-w-[200px]">
            <Label htmlFor="postalCode">{t("account.postalCode")}</Label>
            <Input
              id="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder={t("account.postalCodePlaceholder")}
            />
          </div>
        </div>

        <Separator />

        <Button onClick={handleSave} disabled={saving}>
          {saving ? t("account.saving") : t("account.saveChanges")}
        </Button>
      </CardContent>
    </Card>
  );
}
