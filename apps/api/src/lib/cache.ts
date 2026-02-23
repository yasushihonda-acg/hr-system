/**
 * サーバーサイドインメモリキャッシュ（TTL付き）
 *
 * Cloud Run の各インスタンス内で有効。統計系エンドポイントの
 * 全件読込・集計処理を繰り返さないようにするためのもの。
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** キャッシュから取得。期限切れまたは未存在の場合は null */
export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

/** キャッシュに格納 */
export function setCache<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * キャッシュを削除。prefix 指定時はそのプレフィックスのキーのみ削除。
 * 手動再分類・新規同期後の統計キャッシュ無効化に使用。
 */
export function clearCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export const TTL = {
  STATS: 5 * 60 * 1000, // 統計系: 5分
} as const;
