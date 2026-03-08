/**
 * Next.js ミドルウェア テスト
 *
 * middleware.ts の config.matcher パターンが正しいパスを
 * 保護/除外しているか検証する。
 *
 * Note: middleware.ts は `@/auth` パスエイリアスを使用するため
 * Vitest から直接 import できない。config 値を直接定義して
 * パターンの正しさを検証する。
 */
import { describe, expect, it } from "vitest";

// middleware.ts から抽出した config 値（ソースと同期を保つこと）
const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login|unauthorized).*)"],
};

describe("middleware config", () => {
  const matcherPattern = config.matcher[0]!;
  const excludeMatch = matcherPattern.match(/\(\?!(.*?)\)/);
  const excludePatterns = excludeMatch ? excludeMatch[1]!.split("|") : [];

  function isExcluded(path: string): boolean {
    const normalized = path.startsWith("/") ? path.slice(1) : path;
    return excludePatterns.some((pattern) => normalized.startsWith(pattern));
  }

  describe("保護されるパス（認証必須）", () => {
    const protectedPaths = [
      "/",
      "/inbox",
      "/chat-messages",
      "/admin/users",
      "/admin/spaces",
      "/admin/ai-settings",
      "/dashboard",
      "/help",
    ];

    for (const path of protectedPaths) {
      it(`${path} は保護される`, () => {
        expect(isExcluded(path)).toBe(false);
      });
    }
  });

  describe("除外されるパス（認証不要）", () => {
    const excludedPaths = [
      "/login",
      "/unauthorized",
      "/api/auth/callback/google",
      "/api/auth/signin",
      "/_next/static/chunks/main.js",
      "/_next/image?url=test",
      "/favicon.ico",
    ];

    for (const path of excludedPaths) {
      it(`${path} は除外される`, () => {
        expect(isExcluded(path)).toBe(true);
      });
    }
  });

  describe("matcher 設定の構造", () => {
    it("matcher は1つのパターンを持つ", () => {
      expect(config.matcher).toHaveLength(1);
    });

    it("除外パターンに必須パスが含まれる", () => {
      expect(excludePatterns).toContain("login");
      expect(excludePatterns).toContain("unauthorized");
      expect(excludePatterns).toContain("api/auth");
      expect(excludePatterns).toContain("_next/static");
      expect(excludePatterns).toContain("_next/image");
      expect(excludePatterns).toContain("favicon.ico");
    });
  });
});
