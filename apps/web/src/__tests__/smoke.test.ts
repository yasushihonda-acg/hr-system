import { describe, expect, it } from "vitest";

describe("smoke test", () => {
  it("shared パッケージの型が正しくインポートできる", async () => {
    const shared = await import("@hr-system/shared");
    expect(shared.DRAFT_STATUSES).toBeDefined();
    expect(shared.CHAT_CATEGORIES).toBeDefined();
  });

  it("lib/utils がエクスポートされる", async () => {
    const utils = await import("../lib/utils");
    expect(utils.buildMessageSearchUrl).toBeDefined();
  });
});
