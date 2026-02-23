"use client";

import { Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SyncConfig, SyncStatus } from "@/lib/types";

const INTERVAL_OPTIONS = [
  { label: "5分", value: 5 },
  { label: "15分", value: 15 },
  { label: "30分", value: 30 },
  { label: "1時間", value: 60 },
];

export function ChatSyncButton() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-messages/sync/status");
      if (res.ok) {
        const data: SyncStatus = await res.json();
        setStatus(data);
        return data;
      }
    } catch {
      // ステータス取得失敗は無視
    }
    return null;
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-messages/sync/config");
      if (res.ok) {
        const data: SyncConfig = await res.json();
        setConfig(data);
      }
    } catch {
      // 設定取得失敗は無視
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ポーリング（同期中のみ）
  useEffect(() => {
    if (!isSyncing) return;

    const startTime = Date.now();
    const maxDuration = 30_000; // 最大30秒

    const interval = setInterval(async () => {
      const data = await fetchStatus();
      if (data?.status !== "running" || Date.now() - startTime > maxDuration) {
        setIsSyncing(false);
        clearInterval(interval);
      }
    }, 2_000);

    return () => clearInterval(interval);
  }, [isSyncing, fetchStatus]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/chat-messages/sync", { method: "POST" });
      if (res.status === 409) {
        // 既に実行中
        return;
      }
      if (!res.ok) {
        setIsSyncing(false);
      }
    } catch {
      setIsSyncing(false);
    }
  };

  const handleToggleConfig = () => {
    if (!showConfig) fetchConfig();
    setShowConfig((v) => !v);
  };

  const handleSaveConfig = async (updates: Partial<SyncConfig>) => {
    setIsSavingConfig(true);
    try {
      const res = await fetch("/api/chat-messages/sync/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data: SyncConfig = await res.json();
        setConfig(data);
      }
    } finally {
      setIsSavingConfig(false);
    }
  };

  const lastSyncLabel = status?.lastSyncedAt
    ? `最終同期: ${new Date(status.lastSyncedAt).toLocaleString("ja-JP")}`
    : null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        {lastSyncLabel && <span className="text-xs text-muted-foreground">{lastSyncLabel}</span>}
        {status?.status === "error" && (
          <span className="text-xs text-red-600">エラー: {status.errorMessage}</span>
        )}
        <button
          type="button"
          onClick={handleToggleConfig}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="同期設定"
        >
          <Settings size={15} />
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing || status?.status === "running"}
        >
          {isSyncing || status?.status === "running" ? "同期中..." : "Chat同期"}
        </Button>
      </div>

      {showConfig && config && (
        <div className="w-64 rounded-lg border border-slate-200 bg-white p-4 shadow-md">
          <p className="mb-3 text-xs font-semibold text-slate-700">定期同期設定</p>

          {/* 有効/無効 */}
          <label className="mb-3 flex items-center justify-between">
            <span className="text-xs text-slate-600">自動同期</span>
            <button
              type="button"
              onClick={() => handleSaveConfig({ isEnabled: !config.isEnabled })}
              disabled={isSavingConfig}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                config.isEnabled ? "bg-slate-900" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  config.isEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </label>

          {/* 間隔 */}
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500">同期間隔</p>
            <div className="grid grid-cols-4 gap-1">
              {INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isSavingConfig || !config.isEnabled}
                  onClick={() => handleSaveConfig({ intervalMinutes: opt.value })}
                  className={`rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                    config.intervalMinutes === opt.value
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {config.updatedAt && (
            <p className="mt-3 text-[10px] text-slate-400">
              更新: {new Date(config.updatedAt).toLocaleString("ja-JP")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
