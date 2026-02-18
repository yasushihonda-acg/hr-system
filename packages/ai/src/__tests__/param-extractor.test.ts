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
const { extractSalaryParams } = await import("../param-extractor.js");

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

describe("extractSalaryParams", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it("給与変更メッセージからパラメータを抽出する", async () => {
    mockGeminiResponse(
      JSON.stringify({
        employeeIdentifier: "田中",
        changeType: "discretionary",
        targetSalary: 300000,
        allowanceType: null,
        reasoning: "直接的な金額指定による裁量的変更",
      }),
    );

    const result = await extractSalaryParams("田中さんの給与を30万に変更");

    expect(result.employeeIdentifier).toBe("田中");
    expect(result.targetSalary).toBe(300000);
    expect(result.changeType).toBe("discretionary");
  });

  it("資格取得による機械的変更を抽出する", async () => {
    mockGeminiResponse(
      JSON.stringify({
        employeeIdentifier: "鈴木",
        changeType: "mechanical",
        targetSalary: null,
        allowanceType: "qualification",
        reasoning: "資格取得に伴う資格手当の付与",
      }),
    );

    const result = await extractSalaryParams("鈴木さんが介護福祉士を取得した");

    expect(result.employeeIdentifier).toBe("鈴木");
    expect(result.allowanceType).toBe("qualification");
    expect(result.changeType).toBe("mechanical");
  });

  it("従業員が特定できない場合にnullを返す", async () => {
    mockGeminiResponse(
      JSON.stringify({
        employeeIdentifier: null,
        changeType: "discretionary",
        targetSalary: 250000,
        allowanceType: null,
        reasoning: "従業員名が特定できません",
      }),
    );

    const result = await extractSalaryParams("給与を25万にしてほしい");

    expect(result.employeeIdentifier).toBeNull();
    expect(result.targetSalary).toBe(250000);
  });

  it("LLMが不正JSONを返した場合にエラーを投げる", async () => {
    mockGeminiResponse("不正なレスポンスです");

    await expect(extractSalaryParams("テストメッセージ")).rejects.toThrow();
  });

  it("不正なchangeTypeの場合にエラーを投げる", async () => {
    mockGeminiResponse(
      JSON.stringify({
        employeeIdentifier: "佐藤",
        changeType: "unknown_type",
        targetSalary: null,
        allowanceType: null,
        reasoning: "不正な変更タイプ",
      }),
    );

    await expect(extractSalaryParams("佐藤さんの件")).rejects.toThrow();
  });
});
