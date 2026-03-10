"use client";

import { useEffect } from "react";

/**
 * ヘルプページ専用: 親レイアウトの overflow 制約を一時的に解除し、
 * サイドバーの position:sticky を有効にする。
 *
 * 対象:
 * - <main overflow-y-auto> → overflow:visible（スクロールコンテナ解除）
 * - <div overflow-hidden>（main の親 flex-row）→ overflow:visible
 * - outer div（h-screen overflow-hidden）→ overflow:visible + height:auto
 * アンマウント時に元に戻す。
 */
export function HelpOverflowFix() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const flexRow = main.parentElement;
    const outerDiv = flexRow?.parentElement;

    main.style.overflow = "visible";
    if (flexRow) flexRow.style.overflow = "visible";
    if (outerDiv) {
      outerDiv.style.overflow = "visible";
      outerDiv.style.height = "auto";
      outerDiv.style.minHeight = "100vh";
    }

    return () => {
      main.style.overflow = "";
      if (flexRow) flexRow.style.overflow = "";
      if (outerDiv) {
        outerDiv.style.overflow = "";
        outerDiv.style.height = "";
        outerDiv.style.minHeight = "";
      }
    };
  }, []);
  return null;
}
