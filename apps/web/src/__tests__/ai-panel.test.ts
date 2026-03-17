import { describe, expect, it, vi } from "vitest";

// React / lucide-react のモック（JSX を評価しないため）
vi.mock("react", () => ({}));
vi.mock("lucide-react", () => ({
  Bot: () => null,
  Lightbulb: () => null,
}));
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import {
  CATEGORY_ACTIONS,
  getConfidenceLabel,
} from "../app/(protected)/chat-messages/[id]/ai-panel";

describe("getConfidenceLabel", () => {
  it("スコア 0.8 以上は「高信頼度」を返す", () => {
    expect(getConfidenceLabel(0.8).label).toBe("高信頼度");
    expect(getConfidenceLabel(1.0).label).toBe("高信頼度");
    expect(getConfidenceLabel(0.95).label).toBe("高信頼度");
  });

  it("スコア 0.5〜0.79 は「中信頼度」を返す", () => {
    expect(getConfidenceLabel(0.5).label).toBe("中信頼度");
    expect(getConfidenceLabel(0.79).label).toBe("中信頼度");
    expect(getConfidenceLabel(0.65).label).toBe("中信頼度");
  });

  it("スコア 0.5 未満は「低信頼度」を返す", () => {
    expect(getConfidenceLabel(0.0).label).toBe("低信頼度");
    expect(getConfidenceLabel(0.49).label).toBe("低信頼度");
    expect(getConfidenceLabel(0.1).label).toBe("低信頼度");
  });

  it("境界値 0.8 は「高信頼度」に含まれる", () => {
    expect(getConfidenceLabel(0.8).label).toBe("高信頼度");
  });

  it("境界値 0.5 は「中信頼度」に含まれる", () => {
    expect(getConfidenceLabel(0.5).label).toBe("中信頼度");
  });

  it("各ラベルに対応する color が設定されている", () => {
    expect(getConfidenceLabel(0.9).color).toContain("status-ok");
    expect(getConfidenceLabel(0.6).color).toContain("status-warn");
    expect(getConfidenceLabel(0.2).color).toContain("status-danger");
  });
});

describe("CATEGORY_ACTIONS", () => {
  const ALL_CATEGORIES = [
    "salary",
    "retirement",
    "hiring",
    "contract",
    "transfer",
    "foreigner",
    "training",
    "health_check",
    "attendance",
    "other",
  ];

  it("全10カテゴリにアクションが定義されている", () => {
    for (const cat of ALL_CATEGORIES) {
      expect(CATEGORY_ACTIONS[cat]).toBeDefined();
      expect(CATEGORY_ACTIONS[cat]?.length).toBeGreaterThan(0);
    }
  });

  it("salary カテゴリは給与関連のアクションを含む", () => {
    const actions = CATEGORY_ACTIONS.salary;
    expect(actions).toContain("給与変更ドラフトの確認・作成");
    expect(actions).toContain("SmartHR更新");
  });

  it("未定義カテゴリの場合は undefined を返す（呼び出し側で other にフォールバック）", () => {
    expect(CATEGORY_ACTIONS.unknown_category).toBeUndefined();
  });

  it("other カテゴリは汎用的なアクションを持つ", () => {
    expect(CATEGORY_ACTIONS.other).toEqual(["内容の確認・対応方針の検討"]);
  });
});
