import { collections } from "@hr-system/db";
import type { UserRole } from "@hr-system/shared";
import { OAuth2Client } from "google-auth-library";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

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
    actorRole: import("@hr-system/shared").ActorRole;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  const token = authHeader.slice(7);

  // 開発環境: "dev:{email}" 形式のトークンをバイパス
  if (process.env.NODE_ENV === "development" && token.startsWith("dev:")) {
    const email = token.slice(4);
    const allowedSnap = await collections.allowedUsers
      .where("email", "==", email)
      .where("isActive", "==", true)
      .limit(1)
      .get();
    if (allowedSnap.empty) {
      throw new HTTPException(403, { message: "Access denied: not in allowed users list" });
    }
    const dashboardRole = allowedSnap.docs[0]!.data().role ?? null;
    c.set("user", { email, name: email, sub: email, dashboardRole });
    await next();
    return;
  }

  try {
    const ticket = await client.verifyIdToken({ idToken: token });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error("No email in token");

    // ホワイトリストチェック
    const allowedSnap = await collections.allowedUsers
      .where("email", "==", payload.email)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (allowedSnap.empty) {
      throw new HTTPException(403, { message: "Access denied: not in allowed users list" });
    }

    const dashboardRole = allowedSnap.docs[0]?.data().role ?? null;

    c.set("user", {
      email: payload.email,
      name: payload.name ?? "",
      sub: payload.sub ?? "",
      dashboardRole,
    });
    await next();
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    throw new HTTPException(401, { message: "Invalid token" });
  }
});
