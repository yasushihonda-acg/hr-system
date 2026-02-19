import { Hono } from "hono";
import { logger } from "hono/logger";
import { workerErrorHandler } from "./lib/errors.js";
import { pubsubAuthMiddleware } from "./middleware/pubsub-auth.js";
import { pubsubRoutes } from "./routes/pubsub.js";

const app = new Hono();

app.use("*", logger());

// ヘルスチェック（認証不要）
app.get("/health", (c) =>
  c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }),
);

// Pub/Sub push エンドポイント（OIDC 認証）
app.use("/pubsub/*", pubsubAuthMiddleware);
app.route("/", pubsubRoutes);

// グローバルエラーハンドラ
app.onError(workerErrorHandler);

export { app };
