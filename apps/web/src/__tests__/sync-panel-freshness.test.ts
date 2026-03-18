/**
 * SyncPanel 鮮度チェック (isSyncStale) テスト
 *
 * sync-panel.tsx からエクスポートされた isSyncStale のロジックを検証。
 * - idle + 閾値超過 → stale
 * - idle + 閾値以内 → not stale
 * - error/running → not stale
 * - lastSyncedAt null → stale（未同期 = Infinity）
 * - intervalMinutes による閾値変動
 */
import { describe, expect, it } from "vitest";
import { isSyncStale } from "@/lib/sync-freshness";
import type { SyncStatus } from "@/lib/types";

const BASE: SyncStatus = {
  status: "idle",
  lastSyncedAt: null,
  lastResult: null,
  errorMessage: null,
};

describe("isSyncStale", () => {
  it("idle + 閾値超過 → true", () => {
    const old = new Date(Date.now() - 16 * 60_000).toISOString();
    expect(isSyncStale({ ...BASE, status: "idle", lastSyncedAt: old }, 5)).toBe(true);
  });

  it("idle + ちょうど閾値 → false（> で比較）", () => {
    // 15分ちょうどは閾値以内
    const exact = new Date(Date.now() - 15 * 60_000).toISOString();
    expect(isSyncStale({ ...BASE, status: "idle", lastSyncedAt: exact }, 5)).toBe(false);
  });

  it("idle + 閾値以内 → false", () => {
    const recent = new Date(Date.now() - 10 * 60_000).toISOString();
    expect(isSyncStale({ ...BASE, status: "idle", lastSyncedAt: recent }, 5)).toBe(false);
  });

  it("idle + lastSyncedAt null → false（未同期は stale 扱いしない）", () => {
    expect(isSyncStale({ ...BASE, status: "idle", lastSyncedAt: null }, 5)).toBe(false);
  });

  it("error 状態 → false", () => {
    const old = new Date(Date.now() - 20 * 60_000).toISOString();
    expect(isSyncStale({ ...BASE, status: "error", lastSyncedAt: old }, 5)).toBe(false);
  });

  it("running 状態 → false", () => {
    const old = new Date(Date.now() - 20 * 60_000).toISOString();
    expect(isSyncStale({ ...BASE, status: "running", lastSyncedAt: old }, 5)).toBe(false);
  });

  it("intervalMinutes=10 → 閾値30分", () => {
    const min25 = new Date(Date.now() - 25 * 60_000).toISOString();
    const min35 = new Date(Date.now() - 35 * 60_000).toISOString();
    expect(isSyncStale({ ...BASE, status: "idle", lastSyncedAt: min25 }, 10)).toBe(false);
    expect(isSyncStale({ ...BASE, status: "idle", lastSyncedAt: min35 }, 10)).toBe(true);
  });
});
