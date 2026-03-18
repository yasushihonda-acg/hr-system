import { requireAdmin } from "@/lib/access-control";
import { getChatSyncConfig, getChatSyncStatus } from "@/lib/api";
import { SyncPanel } from "./sync-panel";

export default async function AdminSyncPage() {
  await requireAdmin();
  const [status, config] = await Promise.all([getChatSyncStatus(), getChatSyncConfig()]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Chat同期</h2>
        <p className="text-xs text-muted-foreground">
          Google Chatメッセージの同期状態を監視し、手動同期を実行できます
        </p>
      </div>
      <SyncPanel initialStatus={status} initialConfig={config} />
    </div>
  );
}
