import { validateSignature } from "@line/bot-sdk";

/**
 * LINE Webhook の署名検証。
 * X-Line-Signature ヘッダーと request body の HMAC-SHA256 を比較する。
 */
export function verifyLineSignature(body: string, signature: string | undefined): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
  if (!signature || !channelSecret) return false;
  return validateSignature(body, channelSecret, signature);
}
