import { describe, expect, it } from "vitest";
import { buildSearchUrl } from "../components/chat/attachment-list";

describe("buildSearchUrl", () => {
  it("日本語ファイル名を正しくエンコードしたURL を生成する", () => {
    const url = buildSearchUrl("資格証_ツツミ_ヒロタカ_堤_啓貴_.pdf");
    expect(url).toBe(
      "https://mail.google.com/chat/u/0/#search/%E8%B3%87%E6%A0%BC%E8%A8%BC_%E3%83%84%E3%83%84%E3%83%9F_%E3%83%92%E3%83%AD%E3%82%BF%E3%82%AB_%E5%A0%A4_%E5%95%93%E8%B2%B4_.pdf/cmembership=1",
    );
  });

  it("ASCII ファイル名はそのままURLに含まれる", () => {
    const url = buildSearchUrl("resume.pdf");
    expect(url).toBe("https://mail.google.com/chat/u/0/#search/resume.pdf/cmembership=1");
  });

  it("スペースを含むファイル名をエンコードする", () => {
    const url = buildSearchUrl("my document.pdf");
    expect(url).toBe("https://mail.google.com/chat/u/0/#search/my%20document.pdf/cmembership=1");
  });

  it("cmembership=1 パラメータが末尾に付く", () => {
    const url = buildSearchUrl("test.xlsx");
    expect(url).toContain("/cmembership=1");
  });

  it("u/0 アカウントパスが含まれる", () => {
    const url = buildSearchUrl("test.pdf");
    expect(url).toContain("/chat/u/0/");
  });
});
