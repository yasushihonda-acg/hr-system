import { MessageSquare } from "lucide-react";
import { requireAdmin } from "@/lib/access-control";
import { getChatCredentials, getChatSyncConfig, getChatSyncStatus } from "@/lib/api";
import { SyncPanel } from "./sync-panel";

export default async function AdminSyncPage() {
  await requireAdmin();
  const [status, config, credentials] = await Promise.all([
    getChatSyncStatus(),
    getChatSyncConfig(),
    getChatCredentials()
      .then((r) => r.data)
      .catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
          <MessageSquare className="h-4 w-4 text-emerald-700" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Google Chat 同期</h2>
          <p className="text-xs text-muted-foreground">
            Google Chat スペースのメッセージ取得・同期を管理します
          </p>
        </div>
      </div>
      <SyncPanel initialStatus={status} initialConfig={config} initialCredentials={credentials} />
    </div>
  );
}
