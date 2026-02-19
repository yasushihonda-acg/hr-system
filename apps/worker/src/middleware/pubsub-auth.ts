import { OAuth2Client } from "google-auth-library";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

const client = new OAuth2Client();

/**
 * Google Pub/Sub の OIDC push 認証ミドルウェア。
 * Authorization: Bearer <oidc_token> を検証し、
 * トークンの email が設定済みサービスアカウントと一致することを確認する。
 */
export const pubsubAuthMiddleware = createMiddleware(async (c, next) => {
  // ローカル開発・テスト時は認証をスキップ
  if (process.env.PUBSUB_SKIP_AUTH === "true") {
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing Pub/Sub OIDC token" });
  }

  const token = authHeader.slice(7);
  const audience = process.env.WORKER_URL ?? "";
  const expectedEmail = process.env.PUBSUB_SERVICE_ACCOUNT;
  if (!expectedEmail) {
    throw new HTTPException(500, { message: "PUBSUB_SERVICE_ACCOUNT is not configured" });
  }

  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new Error("No email claim in OIDC token");
    }
    if (payload.email !== expectedEmail) {
      throw new Error(`Unexpected service account: ${payload.email}`);
    }
    await next();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    throw new HTTPException(401, { message: `Invalid Pub/Sub OIDC token: ${msg}` });
  }
});
