"use client";

import { useEffect, useState } from "react";

/**
 * 担当者候補リストを取得するフック。
 * 初回マウント時に API 経由で取得し、セッション中はモジュールレベルでキャッシュする。
 */
let cachedSuggestions: string[] | null = null;

export function useAssigneeSuggestions(): string[] {
  const [suggestions, setSuggestions] = useState<string[]>(cachedSuggestions ?? []);

  useEffect(() => {
    if (cachedSuggestions) return;
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((json: { data: { displayName: string; isActive: boolean }[] }) => {
        const names = json.data
          .filter((u) => u.isActive)
          .map((u) => u.displayName)
          .filter(Boolean);
        cachedSuggestions = names;
        setSuggestions(names);
      })
      .catch(() => {
        // 権限不足等の場合は候補なしで継続
      });
  }, []);

  return suggestions;
}
