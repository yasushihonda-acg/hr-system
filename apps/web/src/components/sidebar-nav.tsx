"use client";

import { BarChart3, ClipboardList, Inbox, ListTodo, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeVariant?: "default" | "warn";
}

export const navItems: NavItem[] = [
  { href: "/inbox", label: "受信箱", shortLabel: "受信箱", icon: Inbox },
  { href: "/task-board", label: "タスク", shortLabel: "タスク", icon: ListTodo },
  { href: "/tasks", label: "承認", shortLabel: "承認", icon: ClipboardList },
  { href: "/dashboard", label: "ダッシュボード", shortLabel: "分析", icon: BarChart3 },
  { href: "/admin", label: "管理", shortLabel: "管理", icon: Settings },
];

export function isNavActive(href: string, pathname: string): boolean {
  return pathname.startsWith(href);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="relative flex w-[60px] flex-col items-center border-r border-border/50 bg-card">
      {/* メインナビ（上部） */}
      <div className="flex flex-1 flex-col items-center gap-1 pt-4">
        {navItems.slice(0, 4).map((item) => (
          <SidebarItem key={item.href} item={item} pathname={pathname} />
        ))}
      </div>

      {/* 設定（下部） */}
      <div className="flex flex-col items-center gap-1 pb-4">
        {navItems.slice(4).map((item) => (
          <SidebarItem key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

function SidebarItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(item.href, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={item.label}
      className={cn(
        "group relative flex w-11 flex-col items-center gap-1 rounded-lg py-2 transition-all duration-200",
        active && "text-[var(--gradient-from)]",
        !active && "text-muted-foreground hover:text-foreground",
      )}
    >
      {/* アクティブインジケーター: 左端のアクセントバー */}
      <span
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200",
          active
            ? "h-6 bg-gradient-to-b from-[var(--gradient-from)] to-[var(--gradient-to)]"
            : "h-0",
        )}
      />

      {/* アクティブ背景 */}
      <span
        className={cn(
          "absolute inset-1 rounded-lg transition-all duration-200",
          active && "bg-[var(--gradient-from)]/[0.06]",
          !active && "group-hover:bg-accent/60",
        )}
      />

      {/* アイコン */}
      <Icon
        className={cn(
          "relative z-10 h-[18px] w-[18px] transition-transform duration-200",
          active && "text-[var(--gradient-from)]",
          !active && "group-hover:scale-105",
        )}
      />

      {/* ラベル */}
      <span
        className={cn(
          "relative z-10 text-[10px] font-medium leading-none tracking-tight",
          active && "font-semibold",
        )}
      >
        {item.shortLabel}
      </span>

      {/* バッジ */}
      {item.badge != null && item.badge > 0 && (
        <span
          className={cn(
            "absolute top-0.5 right-0 z-20 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ring-1.5 ring-card",
            item.badgeVariant === "warn" ? "bg-[var(--status-warn)]" : "bg-destructive",
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
