/**
 * サイドバーナビゲーション テスト
 *
 * App Shell 再設計: 5項目のナビゲーション構造を検証
 * - ナビ項目: 受信箱, タスク, 承認, ダッシュボード, 管理
 * - isNavActive のルーティング判定
 */
import { describe, expect, it, vi } from "vitest";

// sidebar-nav.tsx が依存する外部モジュールをモック
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { isNavActive, navItems } from "../components/sidebar-nav";

describe("sidebar-nav 構造", () => {
  it("ナビゲーション項目が5つであること", () => {
    expect(navItems).toHaveLength(5);
  });

  it("受信箱が /inbox であること", () => {
    const inbox = navItems.find((item) => item.label === "受信箱");
    expect(inbox).toBeDefined();
    expect(inbox!.href).toBe("/inbox");
  });

  it("タスクが /task-board であること", () => {
    const tasks = navItems.find((item) => item.label === "タスク");
    expect(tasks).toBeDefined();
    expect(tasks!.href).toBe("/task-board");
  });

  it("承認が /tasks であること", () => {
    const approval = navItems.find((item) => item.label === "承認");
    expect(approval).toBeDefined();
    expect(approval!.href).toBe("/tasks");
  });

  it("ダッシュボードが /dashboard であること", () => {
    const dashboard = navItems.find((item) => item.label === "ダッシュボード");
    expect(dashboard).toBeDefined();
    expect(dashboard!.href).toBe("/dashboard");
  });

  it("管理が /admin であること", () => {
    const admin = navItems.find((item) => item.label === "管理");
    expect(admin).toBeDefined();
    expect(admin!.href).toBe("/admin");
  });
});

describe("isNavActive ルーティング判定", () => {
  it("/inbox が /inbox でアクティブ", () => {
    expect(isNavActive("/inbox", "/inbox")).toBe(true);
  });

  it("/task-board が /task-board でアクティブ", () => {
    expect(isNavActive("/task-board", "/task-board")).toBe(true);
  });

  it("/task-board が /task-board?priority=high でもアクティブ", () => {
    expect(isNavActive("/task-board", "/task-board?priority=high")).toBe(true);
  });

  it("/tasks が /tasks でアクティブ", () => {
    expect(isNavActive("/tasks", "/tasks")).toBe(true);
  });

  it("/tasks が /tasks/draft-001 でもアクティブ", () => {
    expect(isNavActive("/tasks", "/tasks/draft-001")).toBe(true);
  });

  it("/dashboard が /dashboard でアクティブ", () => {
    expect(isNavActive("/dashboard", "/dashboard")).toBe(true);
  });

  it("/admin が /admin でアクティブ", () => {
    expect(isNavActive("/admin", "/admin")).toBe(true);
  });

  it("/admin が /admin/settings でもアクティブ", () => {
    expect(isNavActive("/admin", "/admin/settings")).toBe(true);
  });

  it("異なるパスではアクティブにならない", () => {
    expect(isNavActive("/inbox", "/tasks")).toBe(false);
    expect(isNavActive("/tasks", "/dashboard")).toBe(false);
    expect(isNavActive("/dashboard", "/admin")).toBe(false);
  });
});
