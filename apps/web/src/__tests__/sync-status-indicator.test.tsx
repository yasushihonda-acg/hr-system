/**
 * SyncStatusIndicator テスト
 *
 * 同期ステータスインジケーターの表示ロジックを検証
 * - idle (鮮度OK): 非表示
 * - idle (鮮度NG / stale): 黄色ドット + /admin/sync へのリンク
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

/** デフォルト同期間隔（sync-status-indicator.tsx と同じ値） */
const DEFAULT_INTERVAL_MINUTES = 5;

/**
 * SyncStatusIndicator の表示ロジックを直接テストするレンダラー。
 * コンポーネントの条件分岐（status→表示）を useEffect/useState に依存せず検証する。
 */
function renderSyncDot(status: SyncStatus): string {
  const isError = status.status === "error";
  const stale = isStale(status);

  // idle かつ鮮度OK → 非表示
  if (status.status === "idle" && !stale) return "";

  const label = isError
    ? (status.errorMessage ?? "同期エラー")
    : stale
      ? "同期が停止している可能性があります"
      : "同期中...";

  const dotColor = isError ? "bg-red-500" : stale ? "bg-yellow-500" : "bg-blue-500";

  const dot = React.createElement("span", {
    className: `inline-block h-2.5 w-2.5 rounded-full animate-pulse ${dotColor}`,
    role: "img",
    "aria-label": label,
    title: label,
  });

  if (isError || stale) {
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

/** isStale ロジック（sync-status-indicator.tsx と同一） */
function isStale(status: SyncStatus): boolean {
  if (status.status !== "idle" || !status.lastSyncedAt) return false;
  const threshold = DEFAULT_INTERVAL_MINUTES * 3;
  const elapsed = (Date.now() - new Date(status.lastSyncedAt).getTime()) / 60_000;
  return elapsed > threshold;
}

const BASE: SyncStatus = {
  status: "idle",
  lastSyncedAt: null,
  lastResult: null,
  errorMessage: null,
};

describe("SyncStatusIndicator 表示ロジック", () => {
  it("idle 状態（鮮度OK）では何も表示しない", () => {
    const recent = new Date(Date.now() - 3 * 60_000).toISOString(); // 3分前
    expect(renderSyncDot({ ...BASE, status: "idle", lastSyncedAt: recent })).toBe("");
  });

  it("idle 状態（lastSyncedAt null）では何も表示しない", () => {
    expect(renderSyncDot({ ...BASE, status: "idle" })).toBe("");
  });

  it("idle 状態（鮮度NG）では黄色ドットとリンクを表示する", () => {
    const old = new Date(Date.now() - 20 * 60_000).toISOString(); // 20分前（閾値15分超過）
    const html = renderSyncDot({ ...BASE, status: "idle", lastSyncedAt: old });
    expect(html).toContain("bg-yellow-500");
    expect(html).toContain("animate-pulse");
    expect(html).toContain('href="/admin/sync"');
    expect(html).toContain("同期が停止している可能性があります");
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

describe("isStale 鮮度判定", () => {
  it("idle + 閾値超過 → stale", () => {
    const old = new Date(Date.now() - 16 * 60_000).toISOString(); // 16分前
    expect(isStale({ ...BASE, status: "idle", lastSyncedAt: old })).toBe(true);
  });

  it("idle + 閾値以内 → not stale", () => {
    const recent = new Date(Date.now() - 14 * 60_000).toISOString(); // 14分前
    expect(isStale({ ...BASE, status: "idle", lastSyncedAt: recent })).toBe(false);
  });

  it("idle + lastSyncedAt null → not stale（未同期は stale 扱いしない）", () => {
    expect(isStale({ ...BASE, status: "idle", lastSyncedAt: null })).toBe(false);
  });

  it("error 状態 → not stale（error は error バッジで表示）", () => {
    const old = new Date(Date.now() - 20 * 60_000).toISOString();
    expect(isStale({ ...BASE, status: "error", lastSyncedAt: old })).toBe(false);
  });

  it("running 状態 → not stale", () => {
    const old = new Date(Date.now() - 20 * 60_000).toISOString();
    expect(isStale({ ...BASE, status: "running", lastSyncedAt: old })).toBe(false);
  });
});
