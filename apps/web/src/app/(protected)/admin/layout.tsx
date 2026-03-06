import { Settings } from "lucide-react";
import type { ReactNode } from "react";
import { AdminTabs } from "./admin-tabs";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-accent shadow-sm">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">管理設定</h1>
          <p className="text-xs text-muted-foreground">ユーザー・スペースの管理</p>
        </div>
      </div>

      <AdminTabs />
      {children}
    </div>
  );
}
