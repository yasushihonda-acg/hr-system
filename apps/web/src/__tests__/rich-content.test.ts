import { describe, expect, it } from "vitest";
import { resolveHtmlMentions, resolveUserMentions } from "../components/chat/rich-content";

const users = [
  { userId: "users/12345", displayName: "山田 花子" },
  { userId: "users/99999", displayName: "田中 太郎" },
];

describe("resolveHtmlMentions", () => {
  it("<users/ID> を @displayName に変換する", () => {
    const result = resolveHtmlMentions("<b>こんにちは</b><users/12345>さん", users);
    expect(result).toBe("<b>こんにちは</b>@山田 花子さん");
  });

  it("複数のメンションを変換する", () => {
    const result = resolveHtmlMentions("<users/12345>と<users/99999>", users);
    expect(result).toBe("@山田 花子と@田中 太郎");
  });

  it("mentionedUsers に存在しない ID は「不明ユーザー」を表示する", () => {
    const result = resolveHtmlMentions("<users/00000>", users);
    expect(result).toBe("@不明ユーザー");
  });

  it("メンションがない場合はそのまま返す", () => {
    const html = "<b>メンションなし</b>";
    expect(resolveHtmlMentions(html, users)).toBe(html);
  });

  it("mentionedUsers が空配列の場合は「不明ユーザー」を表示する", () => {
    const result = resolveHtmlMentions("<users/12345>", []);
    expect(result).toBe("@不明ユーザー");
  });

  it("空文字列はそのまま返す", () => {
    expect(resolveHtmlMentions("", users)).toBe("");
  });
});

describe("resolveUserMentions", () => {
  it("<users/ID> を displayName に変換する", () => {
    const result = resolveUserMentions("こんにちは<users/12345>さん", users);
    expect(result).toBe("こんにちは山田 花子さん");
  });

  it("mentionedUsers に存在しない ID は「不明ユーザー」を表示する", () => {
    const result = resolveUserMentions("<users/00000>", users);
    expect(result).toBe("不明ユーザー");
  });

  it("mentionedUsers が空配列の場合は「不明ユーザー」を表示する", () => {
    const result = resolveUserMentions("<users/12345>", []);
    expect(result).toBe("不明ユーザー");
  });
});
