"use client";

import { useEffect } from "react";

/**
 * ヘルプページ専用: 親レイアウトの overflow 制約を一時的に解除し、
 * サイドバーの position:sticky を有効にする。
 *
 * 対象:
 * - <main overflow-y-auto> → overflow:visible（スクロールコンテナ解除）
 * - <div overflow-hidden>（main の親）→ overflow:visible（sticky コンテキスト解除）
 * アンマウント時に元に戻す。
 */
export function HelpOverflowFix() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const flexRow = main.parentElement;

    main.style.overflow = "visible";
    if (flexRow) flexRow.style.overflow = "visible";

    return () => {
      main.style.overflow = "";
      if (flexRow) flexRow.style.overflow = "";
    };
  }, []);
  return null;
}
