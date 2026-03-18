import type { SyncStatus } from "@/lib/types";

/** lastSyncedAt から現在までの経過分を返す。未同期なら Infinity */
export function getMinutesSinceLastSync(lastSyncedAt: string | null): number {
  if (!lastSyncedAt) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(lastSyncedAt).getTime()) / 60_000;
}

/** status が idle かつ鮮度閾値（intervalMinutes * 3）を超えている場合 true */
export function isSyncStale(status: SyncStatus, intervalMinutes: number): boolean {
  if (status.status !== "idle") return false;
  const threshold = intervalMinutes * 3;
  return getMinutesSinceLastSync(status.lastSyncedAt) > threshold;
}
