"use client";

import {
  BarChart3,
  Bot,
  ClipboardList,
  FileText,
  Inbox,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeVariant?: "default" | "warn";
  admin?: boolean;
}

export const navItems: NavItem[] = [
  { href: "/", label: "ドラフト", icon: FileText },
  { href: "/inbox", label: "受信箱", icon: Inbox },
  { href: "/dashboard", label: "ダッシュ", icon: BarChart3 },
  { href: "/employees", label: "従業員", icon: Users },
  { href: "/chat-messages", label: "チャット", icon: MessageSquare },
  { href: "/audit-logs", label: "監査", icon: ClipboardList },
  { href: "/ai-settings", label: "AI設定", icon: Bot },
  { href: "/admin/users", label: "設定", icon: Settings, admin: true },
];

export function isNavActive(href: string, pathname: string): boolean {
  const matchHref = href === "/admin/users" ? "/admin" : href;
  return matchHref === "/" ? pathname === "/" : pathname.startsWith(matchHref);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-14 flex-col items-center gap-0.5 border-r border-border bg-card pt-3">
      {navItems.map((item) => {
        const active = isNavActive(item.href, pathname);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              "relative flex w-10 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-all duration-150",
              active &&
                !item.admin &&
                "bg-gradient-accent-soft border border-[var(--gradient-from)]/20 text-[var(--gradient-from)]",
              active &&
                item.admin &&
                "bg-destructive/8 border border-destructive/20 text-destructive",
              !active &&
                "border border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 flex-shrink-0",
                active && !item.admin && "text-[var(--gradient-from)]",
                active && item.admin && "text-destructive",
              )}
            />
            <span className="leading-tight">{item.label}</span>
            {item.badge != null && item.badge > 0 && (
              <span
                className={cn(
                  "absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[8px] font-bold text-white ring-1.5 ring-card",
                  item.badgeVariant === "warn" ? "bg-[var(--status-warn)]" : "bg-destructive",
                )}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
