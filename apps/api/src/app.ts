import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());
app.use("/api/*", cors());

app.get("/api/health", (c) =>
  c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }),
);

export { app };
