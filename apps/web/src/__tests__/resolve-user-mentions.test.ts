import { describe, expect, it } from "vitest";
import { resolveUserMentions } from "../components/chat/rich-content";

describe("resolveUserMentions", () => {
  const users = [
    { userId: "users/12345", displayName: "田中 太郎" },
    { userId: "users/67890", displayName: "鈴木 花子" },
  ];

  it("単一の <users/ID> をdisplayNameに変換する", () => {
    expect(resolveUserMentions("<users/12345> さん、こんにちは", users)).toBe(
      "田中 太郎 さん、こんにちは",
    );
  });

  it("複数の <users/ID> を変換する", () => {
    expect(resolveUserMentions("<users/12345> と <users/67890>", users)).toBe(
      "田中 太郎 と 鈴木 花子",
    );
  });

  it("未知のuserIdはIDのみ（users/プレフィックスなし）にフォールバックする", () => {
    expect(resolveUserMentions("<users/99999>", users)).toBe("99999");
  });

  it("mentionedUsersが空配列の場合はIDのみにフォールバックする", () => {
    expect(resolveUserMentions("<users/12345>", [])).toBe("12345");
  });

  it("<users/ID> を含まないテキストはそのまま返す", () => {
    const text = "普通のメッセージです";
    expect(resolveUserMentions(text, users)).toBe(text);
  });

  it("空文字列はそのまま返す", () => {
    expect(resolveUserMentions("", users)).toBe("");
  });
});
