import { Nav } from "@/components/nav";
import { UserMenu } from "@/components/user-menu";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/75 shadow-[0_1px_0_0_oklch(0.88_0.02_240)]">
      {/* アンバーアクセントライン */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[oklch(0.3_0.1_252)] via-[oklch(0.73_0.18_55)] to-[oklch(0.3_0.1_252)]" />
      <div className="mx-auto flex h-13 max-w-7xl items-center justify-between px-4">
        {/* ロゴ */}
        <div className="flex items-center gap-2 md:gap-5">
          <a href="/" className="flex items-center gap-2 group">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground shadow-sm group-hover:shadow-md transition-shadow">
              HR
            </span>
            <span className="text-sm font-bold tracking-tight text-foreground">AI Agent</span>
          </a>
          <div className="h-5 w-px bg-border" />
          <Nav />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
