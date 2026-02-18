import { OAuth2Client } from "google-auth-library";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

const client = new OAuth2Client();

export interface AuthUser {
  email: string;
  name: string;
  sub: string;
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
  try {
    const ticket = await client.verifyIdToken({ idToken: token });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error("No email in token");
    c.set("user", {
      email: payload.email,
      name: payload.name ?? "",
      sub: payload.sub ?? "",
    });
    await next();
  } catch {
    throw new HTTPException(401, { message: "Invalid token" });
  }
});
