import { Timestamp } from "firebase-admin/firestore";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  acquireSyncLock,
  getChatSyncConfig,
  getSyncMetadata,
  syncAllActiveSpaces,
  updateChatSyncConfig,
  updateSyncMetadata,
} from "../services/chat-sync.js";

export const chatSyncRoutes = new Hono();

// 同期操作の権限チェック:
// - GET: 全ロール許可
// - POST/PUT/DELETE: admin + 許可済みサービスアカウントのみ
chatSyncRoutes.use("*", async (c, next) => {
  if (c.req.method !== "GET") {
    const user = c.get("user");
    const isServiceAccount = user.dashboardRole === null && user.name === "system";
    const isAdmin = user.dashboardRole === "admin";
    if (!isServiceAccount && !isAdmin) {
      throw new HTTPException(403, { message: "Admin access required" });
    }
  }
  await next();
});

/**
 * POST /api/chat-messages/sync — 同期実行
 * ?source=scheduler の場合は intervalMinutes チェックを行い、スキップ可能
 * 同期完了まで待機して結果を返す（Cloud Run 途中停止を防止）
 * 409 if already running
 */
chatSyncRoutes.post("/", async (c) => {
  const isScheduler = c.req.query("source") === "scheduler";

  // スケジューラー起動時: 設定で無効または間隔未到達ならスキップ
  if (isScheduler) {
    const config = await getChatSyncConfig();
    if (config && !config.isEnabled) {
      return c.json({ message: "自動同期が無効です" }, 200);
    }
    if (config && config.intervalMinutes > 0) {
      const meta = await getSyncMetadata();
      if (meta?.lastSyncedAt) {
        const elapsedMs = Date.now() - meta.lastSyncedAt.toDate().getTime();
        const intervalMs = config.intervalMinutes * 60 * 1000;
        if (elapsedMs < intervalMs) {
          return c.json({ message: "同期スキップ（間隔未到達）" }, 200);
        }
      }
    }
  }

  // Firestore トランザクションで排他ロック取得（stale lock は 15 分で自動解放）
  const acquired = await acquireSyncLock();
  if (!acquired) {
    return c.json({ error: "同期が既に実行中です" }, 409);
  }

  // 同期実行（完了まで待機 — Cloud Run 途中停止を防止）
  try {
    const results = await syncAllActiveSpaces();
    const totalNew = results.reduce((sum, r) => sum + r.newMessages, 0);
    const totalDup = results.reduce((sum, r) => sum + r.duplicateSkipped, 0);
    const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
    await updateSyncMetadata({
      status: "idle",
      lastSyncedAt: Timestamp.now(),
      lastResult: {
        newMessages: totalNew,
        duplicateSkipped: totalDup,
        durationMs: totalMs,
        syncedAt: Timestamp.now(),
      },
      errorMessage: null,
    });
    return c.json({
      message: "同期が完了しました",
      result: { newMessages: totalNew, duplicateSkipped: totalDup, durationMs: totalMs },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error("Chat sync failed:", message);
    try {
      await updateSyncMetadata({
        status: "error",
        errorMessage: message,
      });
    } catch (updateErr) {
      console.error("Failed to update sync status:", updateErr);
    }
    return c.json({ error: `同期に失敗しました: ${message}` }, 500);
  }
});

/**
 * GET /api/chat-messages/sync/config — 同期設定取得
 */
chatSyncRoutes.get("/config", async (c) => {
  const config = await getChatSyncConfig();
  return c.json({
    intervalMinutes: config?.intervalMinutes ?? 30,
    isEnabled: config?.isEnabled ?? true,
    updatedAt: config?.updatedAt?.toDate().toISOString() ?? null,
    updatedBy: config?.updatedBy ?? null,
  });
});

/**
 * PATCH /api/chat-messages/sync/config — 同期設定更新
 */
chatSyncRoutes.patch("/config", async (c) => {
  const body = await c.req.json<{ intervalMinutes?: number; isEnabled?: boolean }>();
  const user = c.get("user");
  const updatedBy = user?.email ?? "unknown";

  const updates: { intervalMinutes?: number; isEnabled?: boolean } = {};
  if (typeof body.intervalMinutes === "number" && body.intervalMinutes > 0) {
    updates.intervalMinutes = body.intervalMinutes;
  }
  if (typeof body.isEnabled === "boolean") {
    updates.isEnabled = body.isEnabled;
  }

  await updateChatSyncConfig(updates, updatedBy);
  const config = await getChatSyncConfig();
  return c.json({
    intervalMinutes: config?.intervalMinutes ?? 30,
    isEnabled: config?.isEnabled ?? true,
    updatedAt: config?.updatedAt?.toDate().toISOString() ?? null,
    updatedBy: config?.updatedBy ?? null,
  });
});

/**
 * GET /api/chat-messages/sync/status — 同期ステータス取得
 */
chatSyncRoutes.get("/status", async (c) => {
  const meta = await getSyncMetadata();
  if (!meta) {
    return c.json({
      status: "idle",
      lastSyncedAt: null,
      lastResult: null,
      errorMessage: null,
    });
  }

  return c.json({
    status: meta.status,
    lastSyncedAt: meta.lastSyncedAt?.toDate().toISOString() ?? null,
    lastResult: meta.lastResult
      ? {
          newMessages: meta.lastResult.newMessages,
          duplicateSkipped: meta.lastResult.duplicateSkipped,
          durationMs: meta.lastResult.durationMs,
          syncedAt: meta.lastResult.syncedAt.toDate().toISOString(),
        }
      : null,
    errorMessage: meta.errorMessage,
  });
});
