"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  LinkIcon,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getMinutesSinceLastSync, isSyncStale } from "@/lib/sync-freshness";
import type { ChatCredentialsInfo, SyncConfig, SyncStatus } from "@/lib/types";
import {
  disconnectChatAccountAction,
  getChatCredentialsAction,
  getSyncStatusAction,
  triggerSyncAction,
  updateSyncConfigAction,
} from "./actions";

interface SyncPanelProps {
  initialStatus: SyncStatus;
  initialConfig: SyncConfig;
  initialCredentials: ChatCredentialsInfo | null;
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

function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const statusBadge = {
  idle: { label: "正常", variant: "default" as const, className: "bg-green-600" },
  stale: { label: "停止中", variant: "default" as const, className: "bg-yellow-600" },
  running: { label: "同期中", variant: "default" as const, className: "bg-blue-600" },
  error: { label: "エラー", variant: "destructive" as const, className: "" },
} as const;

export function SyncPanel({ initialStatus, initialConfig, initialCredentials }: SyncPanelProps) {
  const [status, setStatus] = useState<SyncStatus>(initialStatus);
  const [config, setConfig] = useState<SyncConfig>(initialConfig);
  const [credentials, setCredentials] = useState<ChatCredentialsInfo | null>(initialCredentials);
  const [interval, setInterval] = useState(String(initialConfig.intervalMinutes));
  const [isPending, startTransition] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ポーリング用: sync status のみ（credentials は操作時のみ更新）
  const refreshStatus = useCallback(() => {
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

  // 完全リフレッシュ: タブ復帰時など credentials も含む
  const refresh = useCallback(() => {
    setActionError(null);
    startTransition(async () => {
      try {
        const [syncResult, credResult] = await Promise.all([
          getSyncStatusAction(),
          getChatCredentialsAction(),
        ]);
        setStatus(syncResult.status);
        setConfig(syncResult.config);
        setInterval(String(syncResult.config.intervalMinutes));
        setCredentials(credResult);
      } catch {
        setActionError("ステータスの取得に失敗しました");
      }
    });
  }, []);

  // 60秒ポーリング（status のみ）+ タブ復帰時の完全リフレッシュ
  useEffect(() => {
    const id = window.setInterval(refreshStatus, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, refreshStatus]);

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

  const handleChatConnect = useCallback(() => {
    if (
      window.confirm(
        "このアカウントで Google Chat の認証を行います。\n連携するアカウントは、対象の Chat スペースに参加しているメンバーである必要があります。\n\n続行しますか？",
      )
    ) {
      window.location.href = "/api/auth/chat-connect";
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setActionError(null);
    startTransition(async () => {
      try {
        await disconnectChatAccountAction();
        setCredentials(null);
      } catch {
        setActionError("連携解除に失敗しました");
      }
    });
  }, []);

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

      {/* Chat Credentials card */}
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <MessageSquare className="h-4 w-4 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Google Chat 連携アカウント</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Google Chat スペースのメッセージ取得に使用するアカウント。
              対象スペースに参加しているメンバーのアカウントが必要です。
            </p>
          </div>
        </div>

        <div className="mt-4">
          {credentials ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{credentials.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {credentials.source === "adc" ? (
                      "サーバー既定の認証（ADC）を使用中"
                    ) : (
                      <>
                        {formatShortDate(credentials.connectedAt)} に連携
                        {credentials.connectedBy && ` (${credentials.connectedBy})`}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleChatConnect}>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  {credentials.source === "adc" ? "アカウントを連携" : "アカウントを変更"}
                </Button>
                {credentials.source !== "adc" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Unlink className="mr-2 h-4 w-4" />
                    解除
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <p className="text-sm text-muted-foreground">認証情報を取得できませんでした</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleChatConnect}>
                <LinkIcon className="mr-2 h-4 w-4" />
                アカウントを連携
              </Button>
            </div>
          )}
        </div>
      </div>

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
