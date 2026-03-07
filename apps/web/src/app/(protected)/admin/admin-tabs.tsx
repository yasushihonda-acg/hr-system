"use client";

import { BookOpen, ClipboardList, MessageSquareMore, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/users", label: "ユーザー", icon: Users },
  { href: "/admin/spaces", label: "スペース", icon: MessageSquareMore },
  { href: "/admin/employees", label: "従業員", icon: ClipboardList },
  { href: "/admin/audit-logs", label: "監査ログ", icon: BookOpen },
  { href: "/admin/ai-settings", label: "AI設定", icon: Settings2 },
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--gradient-from)]/10 text-[var(--gradient-from)]"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
