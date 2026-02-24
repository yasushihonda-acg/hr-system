"use client";

import {
  BarChart3,
  Bot,
  ClipboardList,
  FileText,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "ドラフト", icon: FileText },
  { href: "/dashboard", label: "ダッシュボード", icon: BarChart3 },
  { href: "/employees", label: "従業員", icon: Users },
  { href: "/chat-messages", label: "チャット分析", icon: MessageSquare },
  { href: "/audit-logs", label: "監査ログ", icon: ClipboardList },
  { href: "/ai-settings", label: "AI設定", icon: Bot },
  { href: "/admin/users", label: "管理", icon: Settings },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5">
      {links.map(({ href, label, icon: Icon }) => {
        const activeHref = href === "/admin/users" ? "/admin" : href;
        const active = activeHref === "/" ? pathname === "/" : pathname.startsWith(activeHref);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              "relative flex items-center gap-1.5 rounded-md px-1.5 py-1.5 md:px-2.5 text-sm font-medium transition-all duration-150",
              active
                ? "text-primary nav-active-indicator"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 flex-shrink-0",
                active ? "text-[oklch(0.73_0.18_55)]" : "",
              )}
            />
            <span className="hidden md:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
