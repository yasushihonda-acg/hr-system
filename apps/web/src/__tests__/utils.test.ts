import { describe, expect, it, vi } from "vitest";
import { buildMessageSearchUrl } from "../lib/utils";

// sidebar-nav の依存をモック（@/lib/utils の cn 関数）
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// next/navigation のモック
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

import { isNavActive } from "../components/sidebar-nav";

describe("buildMessageSearchUrl", () => {
  it("本文の先頭30文字でエンコードした検索URLを生成する", () => {
    const url = buildMessageSearchUrl("給与変更をお願いします。詳細は添付の通りです。");
    expect(url).toBe(
      "https://mail.google.com/chat/u/0/#search/%E7%B5%A6%E4%B8%8E%E5%A4%89%E6%9B%B4%E3%82%92%E3%81%8A%E9%A1%98%E3%81%84%E3%81%97%E3%81%BE%E3%81%99%E3%80%82%E8%A9%B3%E7%B4%B0%E3%81%AF%E6%B7%BB%E4%BB%98%E3%81%AE%E9%80%9A%E3%82%8A%E3%81%A7%E3%81%99%E3%80%82/cmembership=1",
    );
  });

  it("30文字を超える場合は先頭30文字のみ使用する", () => {
    const longContent = "a".repeat(50);
    const url = buildMessageSearchUrl(longContent);
    expect(url).toContain(encodeURIComponent("a".repeat(30)));
    expect(url).not.toContain(encodeURIComponent("a".repeat(31)));
  });

  it("空文字列の場合は空文字列を返す", () => {
    expect(buildMessageSearchUrl("")).toBe("");
  });

  it("空白のみの場合は空文字列を返す", () => {
    expect(buildMessageSearchUrl("   ")).toBe("");
  });

  it("cmembership=1 パラメータが末尾に付く", () => {
    const url = buildMessageSearchUrl("テスト");
    expect(url).toContain("/cmembership=1");
  });

  it("u/0 アカウントパスが含まれる", () => {
    const url = buildMessageSearchUrl("テスト");
    expect(url).toContain("/chat/u/0/");
  });
});

describe("isNavActive", () => {
  it("/ はルートパスのみマッチする", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/", "/inbox")).toBe(false);
    expect(isNavActive("/", "/dashboard")).toBe(false);
  });

  it("/inbox は /inbox で始まるパスにマッチする", () => {
    expect(isNavActive("/inbox", "/inbox")).toBe(true);
    expect(isNavActive("/inbox", "/inbox/detail")).toBe(true);
    expect(isNavActive("/inbox", "/")).toBe(false);
  });

  it("/dashboard は /dashboard で始まるパスにマッチする", () => {
    expect(isNavActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavActive("/dashboard", "/dashboard/sub")).toBe(true);
    expect(isNavActive("/dashboard", "/")).toBe(false);
  });

  it("/admin/users は /admin で始まるパスにマッチする", () => {
    expect(isNavActive("/admin/users", "/admin/users")).toBe(true);
    expect(isNavActive("/admin/users", "/admin/other")).toBe(true);
    expect(isNavActive("/admin/users", "/")).toBe(false);
  });

  it("/chat-messages は /chat-messages で始まるパスにマッチする", () => {
    expect(isNavActive("/chat-messages", "/chat-messages")).toBe(true);
    expect(isNavActive("/chat-messages", "/chat-messages/msg-123")).toBe(true);
    expect(isNavActive("/chat-messages", "/")).toBe(false);
  });
});
