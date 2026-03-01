"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { t } from "@/lib/i18n";

function getInitials(firstName: string | null, lastName: string | null): string {
  const f = firstName?.[0]?.toUpperCase() || "";
  const l = lastName?.[0]?.toUpperCase() || "";
  return f + l || "?";
}

interface NavProps {
  avatarBase64?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export function Nav({ avatarBase64, firstName, lastName }: NavProps) {
  const pathname = usePathname();

  return (
    <nav className="border-b">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg">
            {t("nav.appName")}
          </Link>
          <Link
            href="/chat"
            className={`text-sm ${
              pathname === "/chat"
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            }`}
          >
            {t("nav.chat")}
          </Link>
          <Link
            href="/profile"
            className={`text-sm ${
              pathname === "/profile"
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            }`}
          >
            {t("nav.profile")}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/profile">
            <Avatar className="size-8">
              <AvatarImage src={avatarBase64 ?? undefined} alt={t("nav.avatarAlt")} />
              <AvatarFallback className="text-xs">
                {getInitials(firstName ?? null, lastName ?? null)}
              </AvatarFallback>
            </Avatar>
          </Link>
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
