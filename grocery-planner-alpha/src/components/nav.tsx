"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg">
            Grocery Planner
          </Link>
          <Link
            href="/profile"
            className={`text-sm ${
              pathname === "/profile"
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            }`}
          >
            Profile
          </Link>
        </div>
        <SignOutButton />
      </div>
    </nav>
  );
}
