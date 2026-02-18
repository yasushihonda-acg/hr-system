import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth.js";
import { rbacMiddleware } from "./middleware/rbac.js";

const app = new Hono();

app.use("*", logger());
app.use("/api/*", cors());

// /api/health は認証不要
app.get("/api/health", (c) =>
  c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }),
);

// 認証が必要なルート（/api/health 以外）
app.use("/api/*", authMiddleware);
app.use("/api/*", rbacMiddleware);

export { app };
