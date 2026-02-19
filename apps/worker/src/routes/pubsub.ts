import { Hono } from "hono";
import { WorkerError } from "../lib/errors.js";
import { parsePubSubEvent } from "../lib/event-parser.js";
import { processMessage } from "../pipeline/process-message.js";

export const pubsubRoutes = new Hono();

/**
 * POST /pubsub/push
 * Google Pub/Sub push サブスクリプションのエンドポイント。
 *
 * ACK (200): パースエラー、重複、ビジネスエラー
 * NACK (500): LLM/DB 一時エラー → Pub/Sub が最大5回リトライ
 */
pubsubRoutes.post("/pubsub/push", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    // JSON パース失敗 → ACK（リトライしても解決しない）
    console.error("[Worker] /pubsub/push: Invalid JSON body");
    return c.json({ ok: true }, 200);
  }

  let event: Awaited<ReturnType<typeof parsePubSubEvent>>;
  try {
    event = parsePubSubEvent(body);
  } catch (e) {
    // Pub/Sub ペイロードのパースエラー → ACK
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Worker] /pubsub/push: Parse error: ${msg}`);
    return c.json({ ok: true }, 200);
  }

  if (!event) {
    // message.created 以外、または Bot 投稿 → ACK
    return c.json({ ok: true }, 200);
  }

  try {
    await processMessage(event);
    return c.json({ ok: true }, 200);
  } catch (e) {
    if (e instanceof WorkerError && !e.shouldNack) {
      // ビジネスエラー（従業員未特定等）→ ACK（監査ログ済み）
      console.warn(`[Worker] Business error ACK: ${e.code} - ${e.message}`);
      return c.json({ ok: true }, 200);
    }
    // LLM/DB 一時エラー → 500 NACK → Pub/Sub リトライ
    throw e;
  }
});
