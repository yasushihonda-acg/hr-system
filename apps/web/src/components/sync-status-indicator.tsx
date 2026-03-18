"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isSyncStale } from "@/lib/sync-freshness";
import type { SyncStatus } from "@/lib/types";

const POLL_INTERVAL = 60_000;

/** デフォルトの同期間隔（分）。config 未取得時のフォールバック */
const DEFAULT_INTERVAL_MINUTES = 5;

export function SyncStatusIndicator() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchStatus = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/chat-messages/sync/status", {
          signal: controller.signal,
        });
        if (res.ok) {
          setStatus(await res.json());
        }
      } catch {
        // AbortError・ネットワークエラーは無視（次回ポーリングで再試行）
      }
    };

    fetchStatus();
    const id = setInterval(fetchStatus, POLL_INTERVAL);

    // タブ復帰時に即座に再取得
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchStatus();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      controller.abort();
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!status) return null;

  const isError = status.status === "error";
  const stale = isSyncStale(status, DEFAULT_INTERVAL_MINUTES);

  // idle かつ鮮度OK → 表示不要
  if (status.status === "idle" && !stale) return null;

  const label = isError
    ? (status.errorMessage ?? "同期エラー")
    : stale
      ? "同期が停止している可能性があります"
      : "同期中...";

  const dotColor = isError ? "bg-red-500" : stale ? "bg-yellow-500" : "bg-blue-500";

  const dot = (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full animate-pulse ${dotColor}`}
      role="img"
      aria-label={label}
      title={label}
    />
  );

  if (isError || stale) {
    return (
      <Link href="/admin/sync" className="flex items-center" title={`${label} — クリックで詳細`}>
        {dot}
      </Link>
    );
  }

  return dot;
}
