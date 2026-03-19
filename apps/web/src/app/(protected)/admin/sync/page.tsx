import { CheckCircle2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/access-control";
import { getChatSyncConfig, getChatSyncStatus, getLineGroupFreshness } from "@/lib/api";
import type { LineGroupFreshness } from "@/lib/types";
import { SyncPanel } from "./sync-panel";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "取得なし";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes} 分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 時間前`;
  const days = Math.floor(hours / 24);
  return `${days} 日前`;
}

export default async function AdminSyncPage() {
  await requireAdmin();
  const [status, config, lineGroupFreshness] = await Promise.all([
    getChatSyncStatus(),
    getChatSyncConfig(),
    getLineGroupFreshness()
      .then((r) => r.groups)
      .catch(() => [] as LineGroupFreshness[]),
  ]);

  return (
    <div className="space-y-8">
      {/* Google Chat セクション */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
            <MessageSquare className="h-4 w-4 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Google Chat 同期</h2>
            <p className="text-xs text-muted-foreground">
              Google Chat スペースのメッセージ取得・同期状況
            </p>
          </div>
        </div>
        <SyncPanel initialStatus={status} initialConfig={config} />
      </div>

      {/* LINE セクション */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
            <svg
              className="h-4 w-4 text-green-700"
              viewBox="0 0 24 24"
              fill="currentColor"
              role="img"
              aria-label="LINE"
            >
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold">LINE メッセージ取得</h2>
            <p className="text-xs text-muted-foreground">
              LINE グループからの Webhook メッセージ受信状況
            </p>
          </div>
        </div>

        {/* Webhook ステータス */}
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">受信方式</h3>
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Webhook 自動受信
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            LINE Bot が受信したメッセージは Webhook 経由でリアルタイムに保存されます。
            定期同期は不要です。
          </p>
        </div>

        {/* グループ別最終取得日時 */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="p-4 border-b border-border/60">
            <h3 className="text-sm font-semibold">グループ別 最終メッセージ取得</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>グループ名</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>最終取得</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineGroupFreshness.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    LINE グループが登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                lineGroupFreshness.map((group) => (
                  <TableRow key={group.groupId}>
                    <TableCell className="text-sm">{group.groupName}</TableCell>
                    <TableCell>
                      <Badge variant={group.isActive ? "default" : "outline"}>
                        {group.isActive ? "有効" : "無効"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeTime(group.lastMessageAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
