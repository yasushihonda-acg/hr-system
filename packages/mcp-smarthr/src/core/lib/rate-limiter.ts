/**
 * トークンバケット式レート制限
 *
 * SmartHR API の制限に準拠:
 * - 10 req/sec (最小100ms間隔)
 * - 5,000 req/hour
 *
 * 機能:
 * - waitForSlot(): 次のスロットが空くまで待機
 * - onResponse(headers): x-rate-limit-remaining ヘッダー監視
 * - retryAfter429(headers): x-rate-limit-reset に基づく待機時間算出
 */

/** レート制限の設定 */
export interface RateLimiterConfig {
  /** リクエスト間の最小間隔 (ms)。デフォルト: 100 (= 10req/sec) */
  minIntervalMs?: number;
  /** 残量がこの閾値以下でペースダウン。デフォルト: 100 */
  slowdownThreshold?: number;
  /** ペースダウン時の間隔倍率。デフォルト: 3 */
  slowdownMultiplier?: number;
}

const DEFAULT_MIN_INTERVAL_MS = 100;
const DEFAULT_SLOWDOWN_THRESHOLD = 100;
const DEFAULT_SLOWDOWN_MULTIPLIER = 3;

export class RateLimiter {
  private readonly minIntervalMs: number;
  private readonly slowdownThreshold: number;
  private readonly slowdownMultiplier: number;
  private lastRequestTime = 0;
  private isSlowedDown = false;

  constructor(config?: RateLimiterConfig) {
    this.minIntervalMs = config?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.slowdownThreshold = config?.slowdownThreshold ?? DEFAULT_SLOWDOWN_THRESHOLD;
    this.slowdownMultiplier = config?.slowdownMultiplier ?? DEFAULT_SLOWDOWN_MULTIPLIER;
  }

  /**
   * 次のリクエストスロットが空くまで待機する。
   * ペースダウン中は間隔が slowdownMultiplier 倍になる。
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const interval = this.isSlowedDown
      ? this.minIntervalMs * this.slowdownMultiplier
      : this.minIntervalMs;
    const elapsed = now - this.lastRequestTime;
    const waitTime = interval - elapsed;

    if (waitTime > 0) {
      await sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * レスポンスヘッダーからレート制限の残量を監視する。
   * x-rate-limit-remaining が閾値以下ならペースダウンモードに入る。
   */
  onResponse(headers: Headers): void {
    const remaining = headers.get("x-rate-limit-remaining");
    if (remaining !== null) {
      const value = Number(remaining);
      this.isSlowedDown = !Number.isNaN(value) && value <= this.slowdownThreshold;
    }
  }

  /**
   * 429 レスポンス時の待機時間を算出する。
   * x-rate-limit-reset ヘッダーがあればその時刻まで待機、
   * なければ attempt に基づく Exponential Backoff。
   *
   * @param headers レスポンスヘッダー
   * @param attempt リトライ回数 (0-indexed)
   * @returns 待機すべきミリ秒数
   */
  getRetryDelay(headers: Headers, attempt: number): number {
    const resetHeader = headers.get("x-rate-limit-reset");
    if (resetHeader !== null) {
      const resetTime = Number(resetHeader) * 1000; // Unix秒 → ミリ秒
      if (!Number.isNaN(resetTime)) {
        const delay = resetTime - Date.now();
        if (delay > 0) return delay;
      }
    }
    // Exponential Backoff: 1s, 2s, 4s
    return 1000 * 2 ** attempt;
  }

  /** ペースダウン中かどうか */
  get slowedDown(): boolean {
    return this.isSlowedDown;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
