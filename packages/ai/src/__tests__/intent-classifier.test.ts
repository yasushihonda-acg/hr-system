import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock @google-cloud/vertexai before importing the module under test
const mockGenerateContent = vi.fn();

vi.mock("@google-cloud/vertexai", () => ({
  VertexAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: mockGenerateContent,
    }),
  })),
}));

// Import after mocking
const { classifyIntent } = await import("../intent-classifier.js");

import type { ThreadContext } from "../intent-classifier.js";

function mockGeminiResponse(text: string) {
  mockGenerateContent.mockResolvedValueOnce({
    response: {
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
    },
  });
}

describe("classifyIntent", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it("給与変更メッセージをsalaryに分類する", async () => {
    mockGeminiResponse(
      JSON.stringify({
        category: "salary",
        confidence: 0.95,
        reasoning: "給与変更に関するメッセージです",
      }),
    );

    const result = await classifyIntent("田中さんの給与を30万に変更してください");

    expect(result.category).toBe("salary");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.reasoning).toBeTruthy();
  });

  it("退職メッセージをretirementに分類する", async () => {
    mockGeminiResponse(
      JSON.stringify({
        category: "retirement",
        confidence: 0.92,
        reasoning: "退職に関するメッセージです",
      }),
    );

    const result = await classifyIntent("山田さんが退職します");

    expect(result.category).toBe("retirement");
  });

  it("健康診断メッセージをhealth_checkに分類する", async () => {
    mockGeminiResponse(
      JSON.stringify({
        category: "health_check",
        confidence: 0.88,
        reasoning: "健康診断に関するメッセージです",
      }),
    );

    const result = await classifyIntent("健康診断の予約をお願いします");

    expect(result.category).toBe("health_check");
  });

  it("confidenceが0-1の範囲であること", async () => {
    mockGeminiResponse(
      JSON.stringify({
        category: "salary",
        confidence: 0.85,
        reasoning: "給与に関するメッセージ",
      }),
    );

    const result = await classifyIntent("昇給の相談です");

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("LLMが不正JSONを返した場合にエラーを投げる", async () => {
    mockGeminiResponse("これはJSONではありません");

    await expect(classifyIntent("テストメッセージ")).rejects.toThrow();
  });

  it("LLMが不正なcategoryを返した場合にエラーを投げる", async () => {
    mockGeminiResponse(
      JSON.stringify({
        category: "invalid_category",
        confidence: 0.9,
        reasoning: "不正なカテゴリ",
      }),
    );

    await expect(classifyIntent("テストメッセージ")).rejects.toThrow();
  });

  it("confidenceが範囲外の場合にクランプされる", async () => {
    mockGeminiResponse(
      JSON.stringify({
        category: "salary",
        confidence: 1.5,
        reasoning: "高い確信度",
      }),
    );

    const result = await classifyIntent("給与の件");

    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe("classifyIntent — ThreadContext", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  const salaryContext: ThreadContext = {
    parentCategory: "salary",
    parentConfidence: 0.95,
    parentSnippet: "田中さんの給与を変更してください",
    replyCount: 1,
  };

  it("親confidence >= 0.90 の場合、返信は同カテゴリを継承する（AI 呼び出しなし）", async () => {
    const result = await classifyIntent("承知しました", salaryContext);

    expect(result.category).toBe("salary");
    expect(result.confidence).toBeCloseTo(0.95 * 0.9, 5);
    expect(result.classificationMethod).toBe("regex");
    expect(result.regexPattern).toBe("thread_context_inheritance");
    // AI が呼ばれていないこと
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("親confidence < 0.90 の場合、コンテキスト付きプロンプトで Gemini にフォールバック", async () => {
    const lowConfidenceContext: ThreadContext = {
      parentCategory: "other",
      parentConfidence: 0.6,
      parentSnippet: "よろしくお願いします",
      replyCount: 0,
    };

    mockGeminiResponse(
      JSON.stringify({
        category: "salary",
        confidence: 0.8,
        reasoning: "給与に関する返信",
      }),
    );

    const result = await classifyIntent("田中さんの件はどうなりましたか", lowConfidenceContext);

    expect(result.category).toBe("salary");
    expect(result.classificationMethod).toBe("ai");
    expect(mockGenerateContent).toHaveBeenCalledOnce();
  });

  it("context を渡さない場合（後方互換）、従来通りの動作をする", async () => {
    mockGeminiResponse(
      JSON.stringify({
        category: "other",
        confidence: 0.72,
        reasoning: "分類不明のメッセージ",
      }),
    );

    // context 引数なし（後方互換）— regex にマッチしない曖昧なメッセージ
    const result = await classifyIntent("例の件について確認したいのですが");

    expect(result.category).toBe("other");
    expect(result.classificationMethod).toBe("ai");
    expect(mockGenerateContent).toHaveBeenCalledOnce();
  });

  it("親confidence が境界値 0.90 ちょうどの場合、スレッド継承が発動する", async () => {
    const boundaryContext: ThreadContext = {
      parentCategory: "contract",
      parentConfidence: 0.9,
      parentSnippet: "契約変更の件",
      replyCount: 2,
    };

    const result = await classifyIntent("了解です", boundaryContext);

    expect(result.category).toBe("contract");
    expect(result.classificationMethod).toBe("regex");
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});
