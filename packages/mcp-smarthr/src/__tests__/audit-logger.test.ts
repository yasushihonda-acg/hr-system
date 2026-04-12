import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AuditLogEntry,
  AuditLogger,
  type AuditLogStore,
  maskPII,
} from "../core/middleware/audit-logger.js";

describe("maskPII", () => {
  it("should mask PII fields", () => {
    const input = {
      email: "taro@example.com",
      phone: "090-1234-5678",
      department: "engineering",
    };
    const result = maskPII(input);
    expect(result).toEqual({
      email: "***",
      phone: "***",
      department: "engineering",
    });
  });

  it("should mask nested PII fields recursively", () => {
    const input = {
      crew: {
        first_name: "Taro",
        department: "engineering",
      },
    };
    const result = maskPII(input);
    expect(result).toEqual({
      crew: {
        first_name: "***",
        department: "engineering",
      },
    });
  });

  it("should not mask non-PII fields", () => {
    const input = { department: "engineering", page: 1, per_page: 10 };
    const result = maskPII(input);
    expect(result).toEqual(input);
  });

  it("should handle empty object", () => {
    expect(maskPII({})).toEqual({});
  });
});

describe("AuditLogger", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T10:00:00.000Z"));
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it("should log result='success' on successful tool call", async () => {
    const logger = new AuditLogger();

    const result = await logger.logToolCall(
      "list_crews",
      "admin@example.com",
      { page: 1 },
      async () => ({ data: [] }),
    );

    expect(result).toEqual({ data: [] });
    expect(consoleSpy).toHaveBeenCalledOnce();

    const entry: AuditLogEntry = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string);
    expect(entry.tool).toBe("list_crews");
    expect(entry.userEmail).toBe("admin@example.com");
    expect(entry.result).toBe("success");
    expect(entry.severity).toBe("INFO");
    expect(entry.source).toBe("mcp-smarthr");
    expect(entry.requestId).toBeDefined();
  });

  it("should log result='error' on failed tool call and rethrow", async () => {
    const logger = new AuditLogger();
    const error = new Error("API failure");

    await expect(
      logger.logToolCall("get_crew", "admin@example.com", { id: "123" }, async () => {
        throw error;
      }),
    ).rejects.toThrow("API failure");

    expect(consoleSpy).toHaveBeenCalledOnce();
    const entry: AuditLogEntry = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string);
    expect(entry.result).toBe("error");
    expect(entry.severity).toBe("ERROR");
  });

  it("should measure durationMs correctly", async () => {
    const logger = new AuditLogger();

    const promise = logger.logToolCall("list_crews", "admin@example.com", {}, async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return "done";
    });

    await vi.advanceTimersByTimeAsync(150);
    await promise;

    const entry: AuditLogEntry = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string);
    expect(entry.durationMs).toBeGreaterThanOrEqual(150);
  });

  it("should mask PII fields in params", async () => {
    const logger = new AuditLogger();

    await logger.logToolCall(
      "get_crew",
      "admin@example.com",
      { email: "taro@example.com", department: "engineering" },
      async () => ({}),
    );

    const entry: AuditLogEntry = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string);
    expect(entry.params.email).toBe("***");
    expect(entry.params.department).toBe("engineering");
  });

  it("should call store.write when store is provided", async () => {
    const store: AuditLogStore = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    const logger = new AuditLogger(store);

    await logger.logToolCall("list_crews", "admin@example.com", {}, async () => ({}));

    expect(store.write).toHaveBeenCalledOnce();
    const entry = (store.write as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as AuditLogEntry;
    expect(entry.tool).toBe("list_crews");
    expect(entry.result).toBe("success");
  });

  it("should not affect tool result when store.write fails", async () => {
    const store: AuditLogStore = {
      write: vi.fn().mockRejectedValue(new Error("Firestore unavailable")),
    };
    const logger = new AuditLogger(store);

    const result = await logger.logToolCall("list_crews", "admin@example.com", {}, async () => ({
      data: [1, 2, 3],
    }));

    expect(result).toEqual({ data: [1, 2, 3] });
    expect(store.write).toHaveBeenCalledOnce();
  });
});
