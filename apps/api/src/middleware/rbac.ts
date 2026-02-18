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
  const role = resolveRole(user.email);
  c.set("actorRole", role);
  await next();
});

export function requireRole(...roles: ActorRole[]) {
  return createMiddleware(async (c, next) => {
    const actorRole = c.get("actorRole");
    if (!roles.includes(actorRole)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
    await next();
  });
}
