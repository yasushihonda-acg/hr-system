import { HelpCircle } from "lucide-react";
import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import { formatDate } from "@/lib/utils";

export function Header() {
  const today = formatDate(new Date().toISOString());

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/75 shadow-[0_1px_2px_oklch(0.15_0.03_252/0.06)]">
      <div className="flex h-13 items-center justify-between px-5">
        {/* ロゴ */}
        <div className="flex items-center gap-2.5">
          <a href="/" className="flex items-center gap-2 group">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-accent text-xs font-bold text-white shadow-sm group-hover:shadow-md transition-shadow">
              HR
            </span>
            <span className="text-sm font-bold tracking-tight text-gradient-accent">AI Agent</span>
          </a>
        </div>

        {/* 右側: ヘルプ + 日付 + ユーザーメニュー */}
        <div className="flex items-center gap-3">
          <Link
            href="/help"
            title="操作マニュアル"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-4.5 w-4.5" />
          </Link>
          <span className="text-xs text-muted-foreground">{today}</span>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
