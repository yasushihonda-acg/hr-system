"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SyncStatus } from "@/lib/types";

const POLL_INTERVAL = 60_000;

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

  if (!status || status.status === "idle") return null;

  const isError = status.status === "error";
  const label = isError ? (status.errorMessage ?? "同期エラー") : "同期中...";

  const dot = (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full animate-pulse ${
        isError ? "bg-red-500" : "bg-blue-500"
      }`}
      role="img"
      aria-label={label}
      title={label}
    />
  );

  if (isError) {
    return (
      <Link href="/admin/sync" className="flex items-center" title={`${label} — クリックで詳細`}>
        {dot}
      </Link>
    );
  }

  return dot;
}
