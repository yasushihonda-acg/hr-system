import { Nav } from "@/components/nav";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/user-menu";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold">HR-AI Agent</span>
          <Separator orientation="vertical" className="h-6" />
          <Nav />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
