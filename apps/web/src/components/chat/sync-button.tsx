"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SyncStatus } from "@/lib/types";

export function ChatSyncButton() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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

  const lastSyncLabel = status?.lastSyncedAt
    ? `最終同期: ${new Date(status.lastSyncedAt).toLocaleString("ja-JP")}`
    : null;

  return (
    <div className="flex items-center gap-3">
      {lastSyncLabel && <span className="text-xs text-muted-foreground">{lastSyncLabel}</span>}
      {status?.status === "error" && (
        <span className="text-xs text-red-600">エラー: {status.errorMessage}</span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={isSyncing || status?.status === "running"}
      >
        {isSyncing || status?.status === "running" ? "同期中..." : "Chat同期"}
      </Button>
    </div>
  );
}
