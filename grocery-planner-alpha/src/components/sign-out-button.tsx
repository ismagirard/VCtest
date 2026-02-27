"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      {t("nav.signOut")}
    </Button>
  );
}
