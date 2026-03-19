"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getMinutesSinceLastSync, isSyncStale } from "@/lib/sync-freshness";
import type { SyncConfig, SyncStatus } from "@/lib/types";
import { getSyncStatusAction, triggerSyncAction, updateSyncConfigAction } from "./actions";

interface SyncPanelProps {
  initialStatus: SyncStatus;
  initialConfig: SyncConfig;
}

function formatDate(iso: string | null): string {
  if (!iso) return "未同期";
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const statusBadge = {
  idle: { label: "正常", variant: "default" as const, className: "bg-green-600" },
  stale: { label: "停止中", variant: "default" as const, className: "bg-yellow-600" },
  running: { label: "同期中", variant: "default" as const, className: "bg-blue-600" },
  error: { label: "エラー", variant: "destructive" as const, className: "" },
} as const;

export function SyncPanel({ initialStatus, initialConfig }: SyncPanelProps) {
  const [status, setStatus] = useState<SyncStatus>(initialStatus);
  const [config, setConfig] = useState<SyncConfig>(initialConfig);
  const [interval, setInterval] = useState(String(initialConfig.intervalMinutes));
  const [isPending, startTransition] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await getSyncStatusAction();
        setStatus(result.status);
        setConfig(result.config);
        setInterval(String(result.config.intervalMinutes));
      } catch {
        setActionError("ステータスの取得に失敗しました");
      }
    });
  }, []);

  // 60秒ポーリング + タブ復帰時リフレッシュ
  useEffect(() => {
    const id = window.setInterval(refresh, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const handleSync = useCallback(() => {
    setSyncMessage(null);
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await triggerSyncAction();
        setSyncMessage(result.message);
        const updated = await getSyncStatusAction();
        setStatus(updated.status);
      } catch {
        setActionError("同期の実行に失敗しました。しばらく待ってから再試行してください。");
      }
    });
  }, []);

  const handleToggleEnabled = useCallback((checked: boolean) => {
    setActionError(null);
    startTransition(async () => {
      try {
        const updated = await updateSyncConfigAction({ isEnabled: checked });
        setConfig(updated);
      } catch {
        setActionError("設定の更新に失敗しました");
      }
    });
  }, []);

  const handleIntervalSave = useCallback(() => {
    const val = Number.parseInt(interval, 10);
    if (Number.isNaN(val) || val < 1) return;
    setActionError(null);
    startTransition(async () => {
      try {
        const updated = await updateSyncConfigAction({ intervalMinutes: val });
        setConfig(updated);
        setInterval(String(updated.intervalMinutes));
      } catch {
        setActionError("設定の更新に失敗しました");
      }
    });
  }, [interval]);

  const stale = isSyncStale(status, config.intervalMinutes);
  const staleMinutes = Math.floor(getMinutesSinceLastSync(status.lastSyncedAt));
  const badgeKey = stale ? "stale" : status.status;
  const badge = statusBadge[badgeKey];

  return (
    <div className="space-y-6">
      {/* Action error banner */}
      {actionError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">{actionError}</p>
        </div>
      )}

      {/* Stale warning banner */}
      {stale && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-200/60 bg-yellow-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">
              同期が停止している可能性があります
            </p>
            <p className="mt-1 text-sm text-yellow-700">
              最終同期から {staleMinutes} 分経過しています。Cloud Scheduler
              が正常に動作しているか確認してください。
            </p>
          </div>
        </div>
      )}

      {/* Sync error banner */}
      {status.status === "error" && status.errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-800">同期エラーが発生しています</p>
            <p className="mt-1 text-sm text-red-700">{status.errorMessage}</p>
            <p className="mt-2 text-xs text-red-600">
              30分後に自動リトライされます。すぐに再試行するには「今すぐ同期」ボタンを押してください。
            </p>
          </div>
        </div>
      )}

      {/* Success message */}
      {syncMessage && status.status !== "error" && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200/60 bg-green-50 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <p className="text-sm text-green-800">{syncMessage}</p>
        </div>
      )}

      {/* Status card */}
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">同期ステータス</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={isPending}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            </Button>
            <Badge variant={badge.variant} className={badge.className}>
              {badge.label}
            </Badge>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">最終同期</dt>
            <dd className="mt-1 text-sm font-medium">{formatDate(status.lastSyncedAt)}</dd>
          </div>
          {status.lastResult && (
            <>
              <div>
                <dt className="text-xs text-muted-foreground">取得件数</dt>
                <dd className="mt-1 text-sm font-medium">
                  {status.lastResult.newMessages} 件
                  <span className="ml-2 text-xs text-muted-foreground">
                    (重複スキップ: {status.lastResult.duplicateSkipped})
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">処理時間</dt>
                <dd className="mt-1 text-sm font-medium">
                  {(status.lastResult.durationMs / 1000).toFixed(1)} 秒
                </dd>
              </div>
            </>
          )}
        </dl>

        <div className="mt-6">
          <Button
            onClick={handleSync}
            disabled={isPending || status.status === "running"}
            size="sm"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            今すぐ同期
          </Button>
        </div>
      </div>

      {/* Config card */}
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <h2 className="text-sm font-semibold">同期設定</h2>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sync-enabled" className="text-sm">
                自動同期
              </Label>
              <p className="text-xs text-muted-foreground">
                Cloud Scheduler による定期同期を有効にします
              </p>
            </div>
            <Switch
              id="sync-enabled"
              checked={config.isEnabled}
              onCheckedChange={handleToggleEnabled}
              disabled={isPending}
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="sync-interval" className="text-sm">
                同期間隔（分）
              </Label>
              <Input
                id="sync-interval"
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="mt-1"
                disabled={isPending}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleIntervalSave}
              disabled={isPending || Number(interval) === config.intervalMinutes}
            >
              保存
            </Button>
          </div>

          {config.updatedAt && (
            <p className="text-xs text-muted-foreground">
              最終更新: {formatDate(config.updatedAt)}
              {config.updatedBy && ` (${config.updatedBy})`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
