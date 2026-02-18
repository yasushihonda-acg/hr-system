import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { appErrorHandler } from "./lib/errors.js";
import { authMiddleware } from "./middleware/auth.js";
import { rbacMiddleware } from "./middleware/rbac.js";
import { auditLogRoutes } from "./routes/audit-logs.js";
import { employeeRoutes } from "./routes/employees.js";
import { salaryDraftRoutes } from "./routes/salary-drafts.js";

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

// 認証 + RBAC（全 /api/* ルートに適用）
app.use("/api/*", authMiddleware);
app.use("/api/*", rbacMiddleware);

// ビジネスルート
app.route("/api/salary-drafts", salaryDraftRoutes);
app.route("/api/employees", employeeRoutes);
app.route("/api/audit-logs", auditLogRoutes);

// グローバルエラーハンドラ
app.onError(appErrorHandler);

export { app };
