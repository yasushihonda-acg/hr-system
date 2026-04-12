import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../core/lib/rate-limiter.js";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("waitForSlot", () => {
    it("最小間隔を保証する", async () => {
      const limiter = new RateLimiter({ minIntervalMs: 100 });

      // 1回目はすぐ通過
      await limiter.waitForSlot();
      const firstTime = Date.now();

      // 2回目は100ms待つ必要がある
      const waitPromise = limiter.waitForSlot();
      await vi.advanceTimersByTimeAsync(100);
      await waitPromise;
      const secondTime = Date.now();

      expect(secondTime - firstTime).toBeGreaterThanOrEqual(100);
    });

    it("間隔が十分空いていれば即座に通過する", async () => {
      const limiter = new RateLimiter({ minIntervalMs: 100 });

      await limiter.waitForSlot();

      // 200ms経過
      await vi.advanceTimersByTimeAsync(200);

      const before = Date.now();
      await limiter.waitForSlot();
      const after = Date.now();

      expect(after - before).toBe(0);
    });

    it("ペースダウン中は間隔が倍率分広がる", async () => {
      const limiter = new RateLimiter({
        minIntervalMs: 100,
        slowdownThreshold: 50,
        slowdownMultiplier: 3,
      });

      // 残量少ない状態をシミュレート
      limiter.onResponse(new Headers({ "x-rate-limit-remaining": "10" }));
      expect(limiter.slowedDown).toBe(true);

      await limiter.waitForSlot();
      const firstTime = Date.now();

      // ペースダウン中: 100ms * 3 = 300ms 必要
      const waitPromise = limiter.waitForSlot();
      await vi.advanceTimersByTimeAsync(300);
      await waitPromise;
      const secondTime = Date.now();

      expect(secondTime - firstTime).toBeGreaterThanOrEqual(300);
    });
  });

  describe("onResponse", () => {
    it("残量が閾値以下でペースダウンモードに入る", () => {
      const limiter = new RateLimiter({ slowdownThreshold: 100 });

      limiter.onResponse(new Headers({ "x-rate-limit-remaining": "50" }));
      expect(limiter.slowedDown).toBe(true);
    });

    it("残量が閾値より多ければ通常モードを維持する", () => {
      const limiter = new RateLimiter({ slowdownThreshold: 100 });

      limiter.onResponse(new Headers({ "x-rate-limit-remaining": "500" }));
      expect(limiter.slowedDown).toBe(false);
    });

    it("ヘッダーがない場合は状態を変更しない", () => {
      const limiter = new RateLimiter({ slowdownThreshold: 100 });

      // まずペースダウンに入る
      limiter.onResponse(new Headers({ "x-rate-limit-remaining": "10" }));
      expect(limiter.slowedDown).toBe(true);

      // ヘッダーなしのレスポンス → 状態変更なし
      limiter.onResponse(new Headers());
      expect(limiter.slowedDown).toBe(true);
    });

    it("残量が回復したらペースダウンを解除する", () => {
      const limiter = new RateLimiter({ slowdownThreshold: 100 });

      limiter.onResponse(new Headers({ "x-rate-limit-remaining": "10" }));
      expect(limiter.slowedDown).toBe(true);

      limiter.onResponse(new Headers({ "x-rate-limit-remaining": "500" }));
      expect(limiter.slowedDown).toBe(false);
    });
  });

  describe("getRetryDelay", () => {
    it("x-rate-limit-reset ヘッダーに基づいて待機時間を返す", () => {
      const limiter = new RateLimiter();
      const now = Date.now();
      const resetTime = Math.floor(now / 1000) + 5; // 5秒後

      const delay = limiter.getRetryDelay(
        new Headers({ "x-rate-limit-reset": String(resetTime) }),
        0,
      );

      // 5秒前後 (ミリ秒精度の誤差を許容)
      expect(delay).toBeGreaterThan(4000);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it("ヘッダーがない場合は Exponential Backoff を返す", () => {
      const limiter = new RateLimiter();
      const headers = new Headers();

      expect(limiter.getRetryDelay(headers, 0)).toBe(1000);
      expect(limiter.getRetryDelay(headers, 1)).toBe(2000);
      expect(limiter.getRetryDelay(headers, 2)).toBe(4000);
    });

    it("reset時刻が過去の場合は Exponential Backoff にフォールバックする", () => {
      const limiter = new RateLimiter();
      const pastTime = Math.floor(Date.now() / 1000) - 10; // 10秒前

      const delay = limiter.getRetryDelay(
        new Headers({ "x-rate-limit-reset": String(pastTime) }),
        1,
      );

      expect(delay).toBe(2000); // 2^1 * 1000
    });
  });
});
