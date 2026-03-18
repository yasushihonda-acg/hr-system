"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SyncStatus } from "@/lib/types";

const POLL_INTERVAL = 60_000;

export function SyncStatusIndicator() {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/chat-messages/sync/status");
        if (res.ok) {
          setStatus(await res.json());
        }
      } catch {
        // ネットワークエラーは無視（次回ポーリングで再試行）
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
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!status || status.status === "idle") return null;

  const dot = (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full animate-pulse ${
        status.status === "running" ? "bg-blue-500" : "bg-red-500"
      }`}
      title={status.status === "error" ? (status.errorMessage ?? "同期エラー") : "同期中..."}
    />
  );

  if (status.status === "error") {
    return (
      <Link
        href="/admin/sync"
        className="flex items-center"
        title={status.errorMessage ?? "同期エラー — クリックで詳細"}
      >
        {dot}
      </Link>
    );
  }

  return dot;
}
