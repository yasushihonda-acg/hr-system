import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Firestore モック
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock("@hr-system/db", () => ({
  collections: {
    chatMessages: {
      where: mockWhere,
    },
  },
}));

// top-level await はファイルスコープで実行する
const { isDuplicate } = await import("../lib/dedup.js");

// ---------------------------------------------------------------------------
// テストケース
// ---------------------------------------------------------------------------

describe("isDuplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // チェーン: where().limit().get()
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ get: mockGet });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chatMessages に該当 ID がない場合は false を返す（新規メッセージ）", async () => {
    mockGet.mockResolvedValue({ empty: true });

    const result = await isDuplicate("spaces/AAAA-qf5jX0/messages/new-msg");

    expect(result).toBe(false);
    expect(mockWhere).toHaveBeenCalledWith(
      "googleMessageId",
      "==",
      "spaces/AAAA-qf5jX0/messages/new-msg",
    );
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it("chatMessages に該当 ID がある場合は true を返す（重複）", async () => {
    mockGet.mockResolvedValue({ empty: false });

    const result = await isDuplicate("spaces/AAAA-qf5jX0/messages/dup-msg");

    expect(result).toBe(true);
  });

  it("異なる googleMessageId はそれぞれ独立して検索される", async () => {
    mockGet.mockResolvedValueOnce({ empty: false }).mockResolvedValueOnce({ empty: true });

    expect(await isDuplicate("msg-A")).toBe(true);
    expect(await isDuplicate("msg-B")).toBe(false);
    expect(mockWhere).toHaveBeenCalledTimes(2);
  });
});
