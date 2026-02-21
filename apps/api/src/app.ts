import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { appErrorHandler } from "./lib/errors.js";
import { authMiddleware } from "./middleware/auth.js";
import { rbacMiddleware } from "./middleware/rbac.js";
import { adminUserRoutes } from "./routes/admin-users.js";
import { auditLogRoutes } from "./routes/audit-logs.js";
import { chatMessageRoutes } from "./routes/chat-messages.js";
import { classificationRulesRoutes } from "./routes/classification-rules.js";
import { employeeRoutes } from "./routes/employees.js";
import { llmRulesRoutes } from "./routes/llm-rules.js";
import { salaryDraftRoutes } from "./routes/salary-drafts.js";
import { statsRoutes } from "./routes/stats.js";

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
app.route("/api/chat-messages", chatMessageRoutes);
app.route("/api/stats", statsRoutes);
app.route("/api/admin/users", adminUserRoutes);
app.route("/api/classification-rules", classificationRulesRoutes);
app.route("/api/llm-rules", llmRulesRoutes);

// グローバルエラーハンドラ
app.onError(appErrorHandler);

export { app };
