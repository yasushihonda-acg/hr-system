/**
 * Server Actions 認証ガード テスト
 *
 * requireAccess / requireAdmin が正しくリダイレクトするか検証。
 * NextAuth の auth() と Firestore allowedUsers をモックし、
 * redirect() の呼び出し先を確認する。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数 ---
const mockAuth = vi.fn();
const mockRedirect = vi.fn();
const mockFirestoreGet = vi.fn();

// --- next-auth モック ---
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

// --- next/navigation モック ---
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    // redirect は実際には例外を投げて処理を中断する
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

// --- server-only モック（テスト環境では不要） ---
vi.mock("server-only", () => ({}));

// --- Firestore モック ---
vi.mock("@hr-system/db", () => ({
  collections: {
    allowedUsers: {
      where: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: () => mockFirestoreGet(),
          }),
        }),
      }),
    },
  },
}));

describe("access-control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireAccess", () => {
    it("未認証 → /login にリダイレクト", async () => {
      mockAuth.mockResolvedValue(null);

      const { requireAccess } = await import("../lib/access-control");
      await expect(requireAccess()).rejects.toThrow("NEXT_REDIRECT:/login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("セッションに email がない → /login にリダイレクト", async () => {
      mockAuth.mockResolvedValue({ user: { name: "No Email" } });

      const { requireAccess } = await import("../lib/access-control");
      await expect(requireAccess()).rejects.toThrow("NEXT_REDIRECT:/login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("ホワイトリストに存在しない → /unauthorized にリダイレクト", async () => {
      mockAuth.mockResolvedValue({
        user: { email: "unknown@example.com", name: "Unknown" },
      });
      mockFirestoreGet.mockResolvedValue({ empty: true, docs: [] });

      const { requireAccess } = await import("../lib/access-control");
      await expect(requireAccess()).rejects.toThrow("NEXT_REDIRECT:/unauthorized");
      expect(mockRedirect).toHaveBeenCalledWith("/unauthorized");
    });

    it("有効なユーザー → AccessInfo を返す", async () => {
      mockAuth.mockResolvedValue({
        user: { email: "staff@aozora-cg.com", name: "Staff User" },
      });
      mockFirestoreGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({
              email: "staff@aozora-cg.com",
              role: "admin",
              isActive: true,
            }),
          },
        ],
      });

      const { requireAccess } = await import("../lib/access-control");
      const result = await requireAccess();
      expect(result).toEqual({
        email: "staff@aozora-cg.com",
        name: "Staff User",
        role: "admin",
      });
    });

    it("viewer ロール → AccessInfo を返す（requireAccess は通過）", async () => {
      mockAuth.mockResolvedValue({
        user: { email: "viewer@aozora-cg.com", name: "Viewer" },
      });
      mockFirestoreGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({
              email: "viewer@aozora-cg.com",
              role: "viewer",
              isActive: true,
            }),
          },
        ],
      });

      const { requireAccess } = await import("../lib/access-control");
      const result = await requireAccess();
      expect(result).toEqual({
        email: "viewer@aozora-cg.com",
        name: "Viewer",
        role: "viewer",
      });
    });
  });

  describe("requireAdmin", () => {
    it("admin ロール → AccessInfo を返す", async () => {
      mockAuth.mockResolvedValue({
        user: { email: "admin@aozora-cg.com", name: "Admin" },
      });
      mockFirestoreGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({
              email: "admin@aozora-cg.com",
              role: "admin",
              isActive: true,
            }),
          },
        ],
      });

      const { requireAdmin } = await import("../lib/access-control");
      const result = await requireAdmin();
      expect(result).toEqual({
        email: "admin@aozora-cg.com",
        name: "Admin",
        role: "admin",
      });
    });

    it("viewer ロール → /unauthorized にリダイレクト", async () => {
      mockAuth.mockResolvedValue({
        user: { email: "viewer@aozora-cg.com", name: "Viewer" },
      });
      mockFirestoreGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({
              email: "viewer@aozora-cg.com",
              role: "viewer",
              isActive: true,
            }),
          },
        ],
      });

      const { requireAdmin } = await import("../lib/access-control");
      await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/unauthorized");
      expect(mockRedirect).toHaveBeenCalledWith("/unauthorized");
    });

    it("未認証 → /login にリダイレクト（requireAccess 経由）", async () => {
      mockAuth.mockResolvedValue(null);

      const { requireAdmin } = await import("../lib/access-control");
      await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });
  });
});
