import { describe, expect, it } from "vitest";
import { buildMessageSearchUrl, buildSearchQuery } from "../lib/utils";

describe("buildSearchQuery", () => {
  it("句点で区切られた最初の文を返す", () => {
    expect(buildSearchQuery("給与変更をお願いします。詳細は添付の通りです。")).toBe(
      "給与変更をお願いします",
    );
  });

  it("改行で区切られた最初の行を返す", () => {
    expect(buildSearchQuery("1行目の内容\n2行目の内容")).toBe("1行目の内容");
  });

  it("句点がなく25文字以内ならそのまま返す", () => {
    expect(buildSearchQuery("短いメッセージ")).toBe("短いメッセージ");
  });

  it("読点で区切って最初の節を返す（句点なし・25文字超え）", () => {
    // 句点がなく25文字を超える場合、読点で区切る
    expect(
      buildSearchQuery("社労士事務所の担当者について、予定に対して別の配置をしたためです"),
    ).toBe("社労士事務所の担当者について");
  });

  it("読点もなく25文字を超える場合、末尾ひらがな（助詞）を除去する", () => {
    // 「別の配置をしたためで」→末尾の「ためで」を除去→「別の配置をし」→末尾の「をし」も除去→問題
    // 実際には25文字で切ってから末尾ひらがなを除去
    const long = "@社労士事務所：担当者 予定に対して別の配置をしたためです";
    const result = buildSearchQuery(long);
    // 末尾がひらがなで終わらない（助詞で切れない）
    expect(result).not.toMatch(/[ぁ-ん]$/);
    expect(result.length).toBeLessThanOrEqual(25);
  });

  it("25文字で切った結果が全てひらがなの場合はそのまま返す（フォールバック）", () => {
    const allHiragana = "あ".repeat(30);
    const result = buildSearchQuery(allHiragana);
    // replace結果が空→フォールバックでslicedをそのまま返す
    expect(result).toBe("あ".repeat(25));
  });

  it("空文字列の場合は空文字列を返す", () => {
    expect(buildSearchQuery("")).toBe("");
  });

  it("空白のみの場合は空文字列を返す", () => {
    expect(buildSearchQuery("   ")).toBe("");
  });

  it("ユーザー報告のケース: 中途半端な助詞で切れない", () => {
    // 「@社労士事務所：担当者 予定に対して別の配置をしたためで」←こうならない
    const content =
      "@社労士事務所：担当者 予定に対して別の配置をしたためです。次の手配をお願いします。";
    const result = buildSearchQuery(content);
    // 句点で切れるので「@社労士事務所：担当者 予定に対して別の配置をしたためです」だが25文字超え
    // → 読点がないので25文字で切って末尾ひらがな除去
    expect(result).not.toMatch(/[ぁ-ん]$/);
  });

  it("maxLen パラメータをカスタマイズできる", () => {
    const result = buildSearchQuery("短い文章ですが長さを制限します", 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("英数字のみの場合はそのまま切断（ひらがな除去が影響しない）", () => {
    const result = buildSearchQuery("a".repeat(50));
    expect(result).toBe("a".repeat(25));
  });

  it("！で区切る", () => {
    expect(buildSearchQuery("大変です！すぐ対応してください")).toBe("大変です");
  });

  it("？で区切る", () => {
    expect(buildSearchQuery("これは何ですか？確認お願いします")).toBe("これは何ですか");
  });
});

describe("buildMessageSearchUrl", () => {
  it("検索URLを生成する", () => {
    const url = buildMessageSearchUrl("短いテスト");
    expect(url).toBe(
      `https://mail.google.com/chat/u/0/#search/${encodeURIComponent("短いテスト")}/cmembership=1`,
    );
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

  it("createdAt が指定された場合 after:/before: で日付絞り込みが追加される", () => {
    const url = buildMessageSearchUrl("テスト", "2026-03-10T05:00:00Z");
    // 演算子はエンコードせずそのまま渡す（エンコードすると about:blank になる）
    expect(url).toContain("after:2026-03-09");
    expect(url).toContain("before:2026-03-11");
  });

  it("createdAt なしの場合は日付フィルタなし（後方互換）", () => {
    const url = buildMessageSearchUrl("テスト");
    expect(url).not.toContain("after");
    expect(url).not.toContain("before");
  });

  it("不正な createdAt は無視される", () => {
    const url = buildMessageSearchUrl("テスト", "invalid-date");
    expect(url).not.toContain("after");
    expect(url).not.toContain("before");
  });
});
