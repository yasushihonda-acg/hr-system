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

        {/* 右側: 日付 + ユーザーメニュー */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground">{today}</span>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
