"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * サーバーコンポーネントのデータを定期的に再取得するクライアントコンポーネント。
 * タブがバックグラウンドのときはリクエストをスキップする。
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
