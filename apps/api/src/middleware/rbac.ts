import type { ActorRole } from "@hr-system/shared";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

function resolveRole(email: string): ActorRole {
  const ceoEmail = process.env.CEO_EMAIL ?? "";
  const hrManagerEmails = (process.env.HR_MANAGER_EMAILS ?? "").split(",").filter(Boolean);

  if (email === ceoEmail) return "ceo";
  if (hrManagerEmails.includes(email)) return "hr_manager";
  return "hr_staff";
}

export const rbacMiddleware = createMiddleware(async (c, next) => {
  const user = c.get("user");

  // viewer ロールには業務操作権限を付与しない
  if (user.dashboardRole === "viewer") {
    c.set("actorRole", null);
  } else if (user.dashboardRole === null && user.name === "system") {
    // サービスアカウント: 業務操作権限を付与しない（chat-sync 等は独自の権限チェックで許可）
    c.set("actorRole", null);
  } else {
    c.set("actorRole", resolveRole(user.email));
  }
  await next();
});

export function requireRole(...roles: ActorRole[]) {
  return createMiddleware(async (c, next) => {
    const actorRole = c.get("actorRole");
    if (!actorRole || !roles.includes(actorRole)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
    await next();
  });
}
