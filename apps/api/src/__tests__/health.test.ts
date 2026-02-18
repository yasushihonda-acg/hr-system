import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("GET /api/health", () => {
  it("returns healthy status", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; version: string; timestamp: string };
    expect(body.status).toBe("healthy");
    expect(body.version).toBe("0.1.0");
    expect(body.timestamp).toBeDefined();
  });
});
