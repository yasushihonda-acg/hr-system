import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllowedDomains, isAllowedDomain } from "../domain.js";

describe("domain", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getAllowedDomains", () => {
    it("デフォルトで aozora-cg.com と lend.aozora-cg.com を返す", () => {
      const domains = getAllowedDomains();
      expect(domains).toEqual(["aozora-cg.com", "lend.aozora-cg.com"]);
    });

    it("ALLOWED_DOMAINS 環境変数が設定されている場合はそれを使う", () => {
      vi.stubEnv("ALLOWED_DOMAINS", "example.com, test.com");
      const domains = getAllowedDomains();
      expect(domains).toEqual(["example.com", "test.com"]);
    });

    it("環境変数の値を小文字に正規化する", () => {
      vi.stubEnv("ALLOWED_DOMAINS", "Example.COM");
      expect(getAllowedDomains()).toEqual(["example.com"]);
    });

    it("空文字列のエントリを除外する", () => {
      vi.stubEnv("ALLOWED_DOMAINS", "a.com,,b.com,");
      expect(getAllowedDomains()).toEqual(["a.com", "b.com"]);
    });
  });

  describe("isAllowedDomain", () => {
    it("aozora-cg.com ドメインを許可する", () => {
      expect(isAllowedDomain("user@aozora-cg.com")).toBe(true);
    });

    it("lend.aozora-cg.com ドメインを許可する", () => {
      expect(isAllowedDomain("user@lend.aozora-cg.com")).toBe(true);
    });

    it("許可されていないドメインを拒否する", () => {
      expect(isAllowedDomain("user@gmail.com")).toBe(false);
    });

    it("大文字小文字を区別しない", () => {
      expect(isAllowedDomain("User@Aozora-CG.COM")).toBe(true);
    });

    it("@ がないメールは拒否する", () => {
      expect(isAllowedDomain("invalid-email")).toBe(false);
    });

    it("空文字は拒否する", () => {
      expect(isAllowedDomain("")).toBe(false);
    });

    it("サブドメインは完全一致のみ許可する", () => {
      expect(isAllowedDomain("user@sub.aozora-cg.com")).toBe(false);
      expect(isAllowedDomain("user@lend.aozora-cg.com")).toBe(true);
    });
  });
});
