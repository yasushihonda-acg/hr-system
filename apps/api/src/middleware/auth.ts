import { collections } from "@hr-system/db";
import type { UserRole } from "@hr-system/shared";
import { OAuth2Client } from "google-auth-library";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { logger } from "../lib/logger.js";

const client = new OAuth2Client();

export interface AuthUser {
  email: string;
  name: string;
  sub: string;
  dashboardRole: UserRole | null;
}

// Hono の Context に型を付ける
declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    actorRole: import("@hr-system/shared").ActorRole | null;
  }
}

/** allowed_users コレクションを検索し、許可ユーザーのロールを返す（DRY） */
async function resolveAllowedRole(email: string): Promise<UserRole | null> {
  const snap = await collections.allowedUsers
    .where("email", "==", email)
    .where("isActive", "==", true)
    .limit(1)
    .get();
  if (snap.empty) {
    throw new HTTPException(403, { message: "Access denied: not in allowed users list" });
  }
  // biome-ignore lint/style/noNonNullAssertion: snap.empty checked above
  return snap.docs[0]!.data().role ?? null;
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  const token = authHeader.slice(7);

  // 開発環境: "dev:{email}" 形式のトークンをバイパス（NODE_ENV + 明示的フラグの二重ガード）
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_DEV_TOKEN === "true" &&
    token.startsWith("dev:")
  ) {
    const email = token.slice(4);
    logger.debug("Dev token login", { email });
    const dashboardRole = await resolveAllowedRole(email);
    c.set("user", { email, name: email, sub: email, dashboardRole });
    await next();
    return;
  }

  try {
    // audience: Web の OAuth Client ID を指定し、他アプリ向けトークンを拒否
    // 本番環境では必須（フェイルクローズ）。開発環境では未設定時に audience 検証をスキップ
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!audience && process.env.NODE_ENV === "production") {
      logger.error("GOOGLE_CLIENT_ID is not configured in production");
      throw new HTTPException(500, { message: "Server misconfiguration" });
    }
    // トークン検証: audience 付き → 失敗時 audience なしで再試行（SA 用フォールバック）
    // Cloud Scheduler の OIDC トークンは Cloud Run URL を audience に持つため、
    // GOOGLE_CLIENT_ID（Web OAuth用）では検証に失敗する。SA は ALLOWED_SERVICE_ACCOUNTS で担保。
    let ticket: import("google-auth-library").LoginTicket;
    try {
      ticket = await client.verifyIdToken({
        idToken: token,
        ...(audience ? { audience } : {}),
      });
    } catch {
      // audience 不一致の可能性 → audience なしで再検証
      ticket = await client.verifyIdToken({ idToken: token });
    }
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error("No email in token");

    // サービスアカウント: ホワイトリストで明示的に許可されたSAのみ通過
    if (payload.email.endsWith(".iam.gserviceaccount.com")) {
      const allowedSAs = (process.env.ALLOWED_SERVICE_ACCOUNTS ?? "").split(",").filter(Boolean);
      if (allowedSAs.length === 0 || !allowedSAs.includes(payload.email)) {
        logger.warn("Unauthorized service account", { email: payload.email });
        throw new HTTPException(403, { message: "Service account not allowed" });
      }
      logger.info("Service account authenticated", { email: payload.email });
      c.set("user", {
        email: payload.email,
        name: "system",
        sub: payload.sub ?? "",
        dashboardRole: null,
      });
      await next();
      return;
    }

    const dashboardRole = await resolveAllowedRole(payload.email);
    logger.info("Authenticated", { email: payload.email });

    c.set("user", {
      email: payload.email,
      name: payload.name ?? "",
      sub: payload.sub ?? "",
      dashboardRole,
    });
    await next();
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.warn("Token verification failed", { error: String(err) });
    throw new HTTPException(401, { message: "Invalid token" });
  }
});
