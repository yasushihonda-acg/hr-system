/**
 * ヘルプページ コンポーネントテスト
 *
 * @vitest-environment happy-dom
 *
 * - useActiveSection フック: IntersectionObserver モックで正しいセクション ID を返すか検証
 * - metadata: ページタイトルが正しく設定されているか
 * - tocItems / permissionData: データ構造の整合性
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// React hooks のモック
const mockSetState = vi.fn();
let capturedEffect: (() => (() => void) | void) | null = null;

vi.mock("react", () => ({
  useState: (initial: unknown) => [initial, mockSetState],
  useEffect: (fn: () => (() => void) | void) => {
    capturedEffect = fn;
  },
  useRef: () => ({ current: null }),
}));

// lucide-react のモック（help-data.ts がインポートするアイコン）
vi.mock("lucide-react", () => {
  const icon = () => null;
  return {
    BarChart3: icon,
    BookOpen: icon,
    BotMessageSquare: icon,
    CheckCircle2: icon,
    ClipboardList: icon,
    FileText: icon,
    Inbox: icon,
    KeyRound: icon,
    ListTodo: icon,
    LogIn: icon,
    Monitor: icon,
    MessageSquare: icon,
    Shield: icon,
    Users: icon,
  };
});

describe("ヘルプページ", () => {
  describe("metadata", () => {
    it("ページタイトルが正しく設定されている", async () => {
      const { metadata } = await import("../app/(protected)/help/layout");
      expect(metadata.title).toBe("操作マニュアル | HR-AI Agent");
    });
  });

  describe("tocItems", () => {
    it("11セクション定義されている", async () => {
      const { tocItems } = await import("../app/(protected)/help/help-data");
      expect(tocItems).toHaveLength(11);
    });

    it("各項目に id, num, label, icon が存在する", async () => {
      const { tocItems } = await import("../app/(protected)/help/help-data");
      for (const item of tocItems) {
        expect(item.id).toBeTruthy();
        expect(item.num).toMatch(/^\d{2}$/);
        expect(item.label).toBeTruthy();
        expect(item.icon).toBeDefined();
      }
    });

    it("num が 01 から 11 まで連番である", async () => {
      const { tocItems } = await import("../app/(protected)/help/help-data");
      const nums = tocItems.map((t) => t.num);
      const expected = Array.from({ length: 11 }, (_, i) => String(i + 1).padStart(2, "0"));
      expect(nums).toEqual(expected);
    });

    it("id が一意である", async () => {
      const { tocItems } = await import("../app/(protected)/help/help-data");
      const ids = tocItems.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("permissionData", () => {
    it("9つの機能が定義されている", async () => {
      const { permissionData } = await import("../app/(protected)/help/help-data");
      expect(permissionData).toHaveLength(9);
    });

    it("各項目に feature, desc, admin, hr, viewer が存在する", async () => {
      const { permissionData } = await import("../app/(protected)/help/help-data");
      for (const perm of permissionData) {
        expect(typeof perm.feature).toBe("string");
        expect(typeof perm.desc).toBe("string");
        expect(typeof perm.admin).toBe("boolean");
        expect(typeof perm.hr).toBe("boolean");
        expect(typeof perm.viewer).toBe("boolean");
      }
    });

    it("admin は全機能にアクセスできる", async () => {
      const { permissionData } = await import("../app/(protected)/help/help-data");
      expect(permissionData.every((p) => p.admin === true)).toBe(true);
    });

    it("viewer がアクセスできるのはダッシュボードのみ", async () => {
      const { permissionData } = await import("../app/(protected)/help/help-data");
      const viewerAccess = permissionData.filter((p) => p.viewer);
      expect(viewerAccess).toHaveLength(1);
      expect(viewerAccess[0]!.feature).toBe("ダッシュボード");
    });
  });

  describe("useActiveSection", () => {
    let mockObserve: ReturnType<typeof vi.fn>;
    let mockDisconnect: ReturnType<typeof vi.fn>;
    let observerCallback: IntersectionObserverCallback;

    beforeEach(() => {
      mockObserve = vi.fn();
      mockDisconnect = vi.fn();

      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(cb: IntersectionObserverCallback) {
            observerCallback = cb;
          }
          observe = mockObserve;
          disconnect = mockDisconnect;
          unobserve = vi.fn();
        },
      );

      // document.getElementById のモック
      vi.spyOn(document, "getElementById").mockImplementation((id: string) => {
        const el = document.createElement("div");
        el.id = id;
        return el;
      });

      capturedEffect = null;
      mockSetState.mockClear();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("初期値として最初の ID を返す", async () => {
      const { useActiveSection } = await import("../app/(protected)/help/help-data");
      const result = useActiveSection(["section-1", "section-2"]);
      expect(result).toBe("section-1");
    });

    it("空配列の場合は空文字を返す", async () => {
      const { useActiveSection } = await import("../app/(protected)/help/help-data");
      const result = useActiveSection([]);
      expect(result).toBe("");
    });

    it("各 ID の要素を observe する", async () => {
      const { useActiveSection } = await import("../app/(protected)/help/help-data");
      useActiveSection(["sec-a", "sec-b", "sec-c"]);

      expect(capturedEffect).not.toBeNull();
      capturedEffect!();

      expect(mockObserve).toHaveBeenCalledTimes(3);
    });

    it("isIntersecting な要素の ID で setState を呼ぶ", async () => {
      const { useActiveSection } = await import("../app/(protected)/help/help-data");
      useActiveSection(["sec-a", "sec-b"]);

      capturedEffect!();

      const mockEntry = {
        isIntersecting: true,
        target: { id: "sec-b" },
      } as unknown as IntersectionObserverEntry;

      observerCallback([mockEntry], {} as IntersectionObserver);
      expect(mockSetState).toHaveBeenCalledWith("sec-b");
    });

    it("isIntersecting でない要素は無視する", async () => {
      const { useActiveSection } = await import("../app/(protected)/help/help-data");
      useActiveSection(["sec-a", "sec-b"]);

      capturedEffect!();

      const mockEntry = {
        isIntersecting: false,
        target: { id: "sec-b" },
      } as unknown as IntersectionObserverEntry;

      observerCallback([mockEntry], {} as IntersectionObserver);
      expect(mockSetState).not.toHaveBeenCalled();
    });

    it("クリーンアップで disconnect を呼ぶ", async () => {
      const { useActiveSection } = await import("../app/(protected)/help/help-data");
      useActiveSection(["sec-a"]);

      const cleanup = capturedEffect!();
      expect(typeof cleanup).toBe("function");
      (cleanup as () => void)();
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it("存在しない要素はスキップする", async () => {
      vi.spyOn(document, "getElementById").mockReturnValue(null);

      const { useActiveSection } = await import("../app/(protected)/help/help-data");
      useActiveSection(["missing-1", "missing-2"]);

      capturedEffect!();

      expect(mockObserve).not.toHaveBeenCalled();
    });
  });
});
