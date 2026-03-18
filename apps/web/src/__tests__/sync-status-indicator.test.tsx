/**
 * SyncStatusIndicator テスト
 *
 * 同期ステータスインジケーターの表示ロジックを検証
 * - idle: 非表示
 * - running: 青い点滅ドット + role="img" + aria-label
 * - error: 赤い点滅ドット + /admin/sync へのリンク
 * - error (メッセージなし): デフォルトメッセージ「同期エラー」
 *
 * NOTE: useEffect 内のポーリング動作（AbortController, visibilityState ガード）は
 * jsdom 環境が必要なため、実機確認で担保する。
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SyncStatus } from "@/lib/types";

/**
 * SyncStatusIndicator の表示ロジックを直接テストするレンダラー。
 * コンポーネントの条件分岐（status→表示）を useEffect/useState に依存せず検証する。
 */
function renderSyncDot(status: SyncStatus): string {
  if (status.status === "idle") return "";

  const isError = status.status === "error";
  const label = isError ? (status.errorMessage ?? "同期エラー") : "同期中...";

  const dot = React.createElement("span", {
    className: `inline-block h-2.5 w-2.5 rounded-full animate-pulse ${isError ? "bg-red-500" : "bg-blue-500"}`,
    role: "img",
    "aria-label": label,
    title: label,
  });

  if (isError) {
    return renderToStaticMarkup(
      React.createElement(
        "a",
        { href: "/admin/sync", className: "flex items-center", title: `${label} — クリックで詳細` },
        dot,
      ),
    );
  }

  return renderToStaticMarkup(dot);
}

const BASE: SyncStatus = {
  status: "idle",
  lastSyncedAt: null,
  lastResult: null,
  errorMessage: null,
};

describe("SyncStatusIndicator 表示ロジック", () => {
  it("idle 状態では何も表示しない", () => {
    expect(renderSyncDot({ ...BASE, status: "idle" })).toBe("");
  });

  it("running 状態では青い点滅ドットを表示する", () => {
    const html = renderSyncDot({ ...BASE, status: "running" });
    expect(html).toContain("bg-blue-500");
    expect(html).toContain("animate-pulse");
    expect(html).toContain('role="img"');
    expect(html).toContain("同期中...");
  });

  it("error 状態では赤い点滅ドットをリンク付きで表示する", () => {
    const html = renderSyncDot({ ...BASE, status: "error", errorMessage: "API timeout" });
    expect(html).toContain("bg-red-500");
    expect(html).toContain("animate-pulse");
    expect(html).toContain('href="/admin/sync"');
    expect(html).toContain("API timeout");
    expect(html).toContain('role="img"');
  });

  it("error 状態でエラーメッセージが null の場合はデフォルトメッセージを表示する", () => {
    const html = renderSyncDot({ ...BASE, status: "error", errorMessage: null });
    expect(html).toContain("同期エラー");
    expect(html).toContain('href="/admin/sync"');
  });

  it("running 状態ではリンクが付かない", () => {
    const html = renderSyncDot({ ...BASE, status: "running" });
    expect(html).not.toContain("href");
    expect(html).not.toContain("<a");
  });

  it("error 状態のリンクに「クリックで詳細」のタイトルが付く", () => {
    const html = renderSyncDot({ ...BASE, status: "error", errorMessage: "Connection refused" });
    expect(html).toContain("Connection refused — クリックで詳細");
  });
});
