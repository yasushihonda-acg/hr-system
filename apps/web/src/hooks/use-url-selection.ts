"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * URL クエリパラメータ `id` による選択状態管理フック。
 * task-board / inbox 等で共通利用。
 */
export function useUrlSelection(basePath: string) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const select = useCallback(
    (id: string | null) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (id) {
        sp.set("id", id);
      } else {
        sp.delete("id");
      }
      router.replace(`${basePath}?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams, basePath],
  );

  return select;
}
