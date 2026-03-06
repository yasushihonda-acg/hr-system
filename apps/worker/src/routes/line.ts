import { Hono } from "hono";
import { verifyLineSignature } from "../lib/line-signature.js";
import { processLineEvent } from "../pipeline/process-line-message.js";

export const lineRoutes = new Hono();

/**
 * POST /line/webhook
 * LINE Messaging API Webhook エンドポイント。
 *
 * LINE は常に 200 OK を期待する（エラー時もリトライ機構なし）。
 * 署名検証に失敗した場合のみ 401 を返す。
 */
lineRoutes.post("/line/webhook", async (c) => {
  const signature = c.req.header("x-line-signature");
  const body = await c.req.text();

  if (!verifyLineSignature(body, signature)) {
    console.error("[LineWebhook] Signature verification failed");
    return c.json({ error: "Unauthorized" }, 401);
  }

  let parsed: { events?: unknown[] };
  try {
    parsed = JSON.parse(body);
  } catch {
    console.error("[LineWebhook] Invalid JSON body");
    return c.json({ ok: true }, 200);
  }

  const events = parsed.events ?? [];

  // LINE は複数イベントをバッチ送信する場合がある
  for (const event of events) {
    try {
      await processLineEvent(event as Parameters<typeof processLineEvent>[0]);
    } catch (e) {
      // 個別イベントのエラーは log して続行（LINE にはリトライ機構がないため）
      console.error(`[LineWebhook] Event processing error: ${String(e)}`);
    }
  }

  return c.json({ ok: true }, 200);
});
