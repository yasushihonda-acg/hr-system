"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/users", label: "ユーザー" },
  { href: "/admin/spaces", label: "スペース" },
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 border-b">
      {tabs.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "pb-2 text-sm font-medium border-b-2 -mb-[2px] transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
