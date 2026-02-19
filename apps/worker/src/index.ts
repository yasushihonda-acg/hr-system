import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.PORT) || 3002;

console.log(`Worker server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
