import { Hono } from "hono";
import { getSyncMetadata, syncChatMessages, updateSyncMetadata } from "../services/chat-sync.js";

export const chatSyncRoutes = new Hono();

/**
 * POST /api/chat-messages/sync — 同期開始
 * 409 if already running, 202 accepted
 */
chatSyncRoutes.post("/", async (c) => {
  const meta = await getSyncMetadata();
  if (meta?.status === "running") {
    return c.json({ error: "同期が既に実行中です" }, 409);
  }

  await updateSyncMetadata({
    status: "running",
    errorMessage: null,
  });

  // バックグラウンドで同期実行
  const syncPromise = syncChatMessages();
  syncPromise
    .then(async (result) => {
      const { Timestamp } = await import("firebase-admin/firestore");
      await updateSyncMetadata({
        status: "idle",
        lastSyncedAt: Timestamp.now(),
        lastResult: {
          newMessages: result.newMessages,
          duplicateSkipped: result.duplicateSkipped,
          durationMs: result.durationMs,
          syncedAt: Timestamp.now(),
        },
        errorMessage: null,
      });
    })
    .catch(async (err: unknown) => {
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
    });

  return c.json({ message: "同期を開始しました" }, 202);
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
