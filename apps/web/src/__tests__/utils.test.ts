import { describe, expect, it } from "vitest";
import { buildMessageSearchUrl, buildSearchQuery, truncateAtNounBoundary } from "../lib/utils";

describe("truncateAtNounBoundary", () => {
  it("漢字の直後（助詞の直前）で切断する", () => {
    // 「配置」の直後で切る（「を」は助詞＝ひらがな）
    expect(truncateAtNounBoundary("予定に対して別の配置をしたためです", 20)).toBe(
      "予定に対して別の配置",
    );
  });

  it("カタカナの直後でも切断する", () => {
    // 16文字: 「本日のミーティングについて確認し」→ i=15「し」(ひらがな)+「認」(漢字)→ 境界 →「確認」直後で切断
    expect(truncateAtNounBoundary("本日のミーティングについて確認します", 16)).toBe(
      "本日のミーティングについて確認",
    );
    // 15文字: 「本日のミーティングについて確認」→ 末尾「認」は漢字、後方探索で「グ」(カタカナ)+「に」(ひらがな)境界 → i=9で切断
    expect(truncateAtNounBoundary("本日のミーティングについて確認します", 15)).toBe(
      "本日のミーティング",
    );
  });

  it("ユーザー報告ケース: 「配置」の直後で切断", () => {
    expect(
      truncateAtNounBoundary("@社労士事務所：担当者 予定に対して別の配置をしたためです", 25),
    ).toBe("@社労士事務所：担当者 予定に対して別の配置");
  });

  it("最低8文字を保証する（短すぎる位置では切らない）", () => {
    // 8文字未満の位置に境界があっても使わない
    const result = truncateAtNounBoundary("漢字あいうえおかきくけこさしすせそ", 20);
    expect(result.length).toBeGreaterThanOrEqual(8);
  });

  it("名詞境界が見つからない場合は末尾ひらがな除去でフォールバック", () => {
    const result = truncateAtNounBoundary("abcdefghijklmnopqrstuvwxyz1234567890", 25);
    expect(result).toBe("abcdefghijklmnopqrstuvwxy");
  });

  it("全ひらがなの場合はそのまま返す（フォールバック）", () => {
    const result = truncateAtNounBoundary("あ".repeat(30), 25);
    expect(result).toBe("あ".repeat(25));
  });
});

describe("buildSearchQuery", () => {
  it("句点で区切られた最初の文を返す", () => {
    expect(buildSearchQuery("給与変更をお願いします。詳細は添付の通りです。")).toBe(
      "給与変更をお願いします",
    );
  });

  it("改行はスペースに正規化して結合する", () => {
    expect(buildSearchQuery("1行目の内容\n2行目の内容")).toBe("1行目の内容 2行目の内容");
  });

  it("句点がなく25文字以内ならそのまま返す", () => {
    expect(buildSearchQuery("短いメッセージ")).toBe("短いメッセージ");
  });

  it("読点で区切って最初の節を返す（句点なし・25文字超え）", () => {
    expect(
      buildSearchQuery("社労士事務所の担当者について、予定に対して別の配置をしたためです"),
    ).toBe("社労士事務所の担当者について");
  });

  it("読点もなく25文字を超える場合、名詞境界で切断する", () => {
    const long = "@社労士事務所：担当者 予定に対して別の配置をしたためです";
    const result = buildSearchQuery(long);
    expect(result).toBe("@社労士事務所：担当者 予定に対して別の配置");
  });

  it("空文字列の場合は空文字列を返す", () => {
    expect(buildSearchQuery("")).toBe("");
  });

  it("空白のみの場合は空文字列を返す", () => {
    expect(buildSearchQuery("   ")).toBe("");
  });

  it("ユーザー報告のケース: 名詞の直後で切れる", () => {
    const content =
      "@社労士事務所：担当者 予定に対して別の配置をしたためです。次の手配をお願いします。";
    const result = buildSearchQuery(content);
    // 句点で切れるが25文字超え → 名詞境界で切断
    expect(result).toBe("@社労士事務所：担当者 予定に対して別の配置");
  });

  it("改行区切りのメッセージでも名詞境界で切断する", () => {
    const content =
      "@社労士事務所：担当者\n予定に対して別の配置をしたためです。次の手配をお願いします。";
    const result = buildSearchQuery(content);
    // 改行→スペース正規化後、句点で切れるが25文字超え → 名詞境界で切断
    expect(result).toBe("@社労士事務所：担当者 予定に対して別の配置");
  });

  it("maxLen パラメータをカスタマイズできる", () => {
    const result = buildSearchQuery("短い文章ですが長さを制限します", 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("英数字のみの場合はそのまま切断", () => {
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
