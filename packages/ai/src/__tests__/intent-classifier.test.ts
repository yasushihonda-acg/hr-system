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
