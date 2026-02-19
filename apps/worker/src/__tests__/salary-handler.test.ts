import type { IntentClassificationResult } from "@hr-system/ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent } from "../lib/event-parser.js";

// ---------------------------------------------------------------------------
// モック設定
// ---------------------------------------------------------------------------

const mockExtractSalaryParams = vi.fn();
vi.mock("@hr-system/ai", () => ({
  extractSalaryParams: mockExtractSalaryParams,
  classifyIntent: vi.fn(),
}));

const mockGenerateDiscretionaryProposals = vi.fn();
const mockApplyMechanicalChange = vi.fn();
const mockBuildBreakdown = vi.fn();
const mockToChangeItems = vi.fn();

vi.mock("@hr-system/salary", () => ({
  generateDiscretionaryProposals: mockGenerateDiscretionaryProposals,
  applyMechanicalChange: mockApplyMechanicalChange,
  buildBreakdown: mockBuildBreakdown,
  toChangeItems: mockToChangeItems,
}));

// Firestore モック
const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn();
const mockBatch = { set: mockBatchSet, commit: mockBatchCommit };

const mockEmployeesWhere = vi.fn();
const mockSalariesWhere = vi.fn();
const mockPitchTablesWhere = vi.fn();
const mockAllowanceMastersWhere = vi.fn();

vi.mock("@hr-system/db", () => ({
  db: { batch: vi.fn(() => mockBatch) },
  collections: {
    employees: { where: mockEmployeesWhere },
    salaries: { where: mockSalariesWhere },
    salaryDrafts: { doc: vi.fn(() => ({ id: "draft-001" })) },
    salaryDraftItems: { doc: vi.fn(() => ({ id: "item-001" })) },
    auditLogs: { doc: vi.fn(() => ({ id: "audit-001" })) },
    pitchTables: { where: mockPitchTablesWhere },
    allowanceMasters: { where: mockAllowanceMastersWhere },
  },
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP") },
  Timestamp: { fromDate: vi.fn((d: Date) => ({ toDate: () => d })) },
}));

// ---------------------------------------------------------------------------
// テストデータ
// ---------------------------------------------------------------------------

const MOCK_BREAKDOWN = {
  baseSalary: 247000,
  positionAllowance: 20000,
  regionAllowance: 0,
  qualificationAllowance: 0,
  otherAllowance: 0,
  total: 267000,
};

const MOCK_AFTER_BREAKDOWN = {
  baseSalary: 260000,
  positionAllowance: 20000,
  regionAllowance: 0,
  qualificationAllowance: 0,
  otherAllowance: 0,
  total: 280000,
};

function makeEvent(): ChatEvent {
  return {
    spaceName: "spaces/AAAA-qf5jX0",
    googleMessageId: "spaces/AAAA-qf5jX0/messages/abc123",
    senderUserId: "users/12345",
    senderName: "田中 太郎",
    senderType: "HUMAN",
    text: "山田さんの給与を2ピッチ上げてください",
    formattedText: null,
    messageType: "MESSAGE",
    threadName: null,
    parentMessageId: null,
    mentionedUsers: [],
    annotations: [],
    attachments: [],
    isEdited: false,
    isDeleted: false,
    rawPayload: {},
    createdAt: new Date("2026-02-19T10:00:00Z"),
  };
}

function makeIntentResult(
  overrides: Partial<IntentClassificationResult> = {},
): IntentClassificationResult {
  return {
    category: "salary",
    confidence: 0.95,
    reasoning: "給与変更指示",
    classificationMethod: "ai",
    regexPattern: null,
    ...overrides,
  };
}

function setupFirestoreMocks() {
  // employees: employeeNumber で見つかる
  const mockEmployeeGet = vi.fn().mockResolvedValue({
    empty: false,
    docs: [
      {
        id: "emp-001",
        data: () => ({ employeeNumber: "E001", name: "山田 花子", isActive: true }),
      },
    ],
  });
  mockEmployeesWhere.mockReturnValue({
    where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ get: mockEmployeeGet }) }),
  });

  // salaries
  const mockSalaryGet = vi.fn().mockResolvedValue({
    empty: false,
    docs: [
      {
        id: "salary-001",
        data: () => ({
          employeeId: "emp-001",
          baseSalary: 247000,
          positionAllowance: 20000,
          regionAllowance: 0,
          qualificationAllowance: 0,
          otherAllowance: 0,
          totalSalary: 267000,
          effectiveTo: null,
        }),
      },
    ],
  });
  mockSalariesWhere.mockReturnValue({
    where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ get: mockSalaryGet }) }),
  });

  // pitchTables
  const mockPitchGet = vi.fn().mockResolvedValue({
    docs: [
      { data: () => ({ grade: 5, step: 3, amount: 247000, isActive: true }) },
      { data: () => ({ grade: 5, step: 5, amount: 260000, isActive: true }) },
    ],
  });
  mockPitchTablesWhere.mockReturnValue({ get: mockPitchGet });

  // allowanceMasters
  const mockAllowanceGet = vi.fn().mockResolvedValue({ docs: [] });
  mockAllowanceMastersWhere.mockReturnValue({ get: mockAllowanceGet });
}

// ---------------------------------------------------------------------------
// テストケース
// ---------------------------------------------------------------------------

const { handleSalary } = await import("../pipeline/salary-handler.js");

describe("handleSalary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestoreMocks();
    mockBuildBreakdown.mockReturnValue(MOCK_BREAKDOWN);
    mockToChangeItems.mockReturnValue([
      {
        itemType: "base_salary",
        itemName: "基本給",
        beforeAmount: 247000,
        afterAmount: 260000,
        isChanged: true,
      },
    ]);
    mockBatchCommit.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("裁量的変更 (discretionary)", () => {
    beforeEach(() => {
      mockExtractSalaryParams.mockResolvedValue({
        employeeIdentifier: "E001",
        changeType: "discretionary",
        targetSalary: 300000,
        allowanceType: null,
        reasoning: "市場水準に合わせた調整",
      });
      mockGenerateDiscretionaryProposals.mockReturnValue([
        {
          proposalNumber: 1,
          description: "基本給 260,000円案",
          result: {
            changeType: "discretionary",
            before: MOCK_BREAKDOWN,
            after: { ...MOCK_AFTER_BREAKDOWN, baseSalary: 280000, total: 300000 },
            items: [],
          },
        },
      ]);
    });

    it("1案のドラフトが正常に作成される", async () => {
      await handleSalary("chat-001", makeEvent(), makeIntentResult());

      expect(mockBatchCommit).toHaveBeenCalledOnce();
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: "draft", changeType: "discretionary" }),
      );
    });

    it("3案が生成された場合は 3 回の draft 保存を実行する", async () => {
      mockGenerateDiscretionaryProposals.mockReturnValue([
        {
          proposalNumber: 1,
          description: "案1",
          result: {
            changeType: "discretionary",
            before: MOCK_BREAKDOWN,
            after: MOCK_AFTER_BREAKDOWN,
            items: [],
          },
        },
        {
          proposalNumber: 2,
          description: "案2",
          result: {
            changeType: "discretionary",
            before: MOCK_BREAKDOWN,
            after: { ...MOCK_AFTER_BREAKDOWN, baseSalary: 265000 },
            items: [],
          },
        },
        {
          proposalNumber: 3,
          description: "案3",
          result: {
            changeType: "discretionary",
            before: MOCK_BREAKDOWN,
            after: { ...MOCK_AFTER_BREAKDOWN, baseSalary: 270000 },
            items: [],
          },
        },
      ]);

      await handleSalary("chat-001", makeEvent(), makeIntentResult());

      // draft x3 + items x3 + audit x3 = 9 回以上の set
      expect(mockBatchSet.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it("targetSalary が null の場合は WorkerError(SALARY_CALC_ERROR) をスロー", async () => {
      mockExtractSalaryParams.mockResolvedValue({
        employeeIdentifier: "E001",
        changeType: "discretionary",
        targetSalary: null,
        allowanceType: null,
        reasoning: "",
      });

      await expect(handleSalary("chat-001", makeEvent(), makeIntentResult())).rejects.toThrow(
        expect.objectContaining({ code: "SALARY_CALC_ERROR", shouldNack: false }),
      );
    });
  });

  describe("機械的変更 (mechanical) — pitch_change", () => {
    beforeEach(() => {
      mockExtractSalaryParams.mockResolvedValue({
        employeeIdentifier: "E001",
        changeType: "mechanical",
        targetSalary: 260000,
        allowanceType: null,
        reasoning: "2ピッチアップ",
      });
      mockApplyMechanicalChange.mockReturnValue({
        changeType: "mechanical",
        before: MOCK_BREAKDOWN,
        after: MOCK_AFTER_BREAKDOWN,
        items: [],
      });
    });

    it("pitch_change ドラフトが正常に作成される", async () => {
      await handleSalary("chat-001", makeEvent(), makeIntentResult());

      expect(mockApplyMechanicalChange).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "pitch_change", newGrade: 5, newStep: 5 }),
        expect.anything(),
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("ドラフトの changeType が mechanical になる", async () => {
      await handleSalary("chat-001", makeEvent(), makeIntentResult());

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ changeType: "mechanical" }),
      );
    });
  });

  describe("機械的変更 (mechanical) — allowance", () => {
    beforeEach(() => {
      mockExtractSalaryParams.mockResolvedValue({
        employeeIdentifier: "E001",
        changeType: "mechanical",
        targetSalary: null,
        allowanceType: "position",
        reasoning: "役職手当追加",
      });

      // allowanceMasters に position エントリを追加
      const mockAllowanceGet = vi.fn().mockResolvedValue({
        docs: [
          {
            data: () => ({
              allowanceType: "position",
              code: "POS-001",
              name: "役職手当",
              amount: 30000,
              isActive: true,
            }),
          },
        ],
      });
      mockAllowanceMastersWhere.mockReturnValue({ get: mockAllowanceGet });

      mockApplyMechanicalChange.mockReturnValue({
        changeType: "mechanical",
        before: MOCK_BREAKDOWN,
        after: { ...MOCK_AFTER_BREAKDOWN, positionAllowance: 30000, total: 277000 },
        items: [],
      });
    });

    it("add_allowance ドラフトが正常に作成される", async () => {
      await handleSalary("chat-001", makeEvent(), makeIntentResult());

      expect(mockApplyMechanicalChange).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "add_allowance", allowanceType: "position" }),
        expect.anything(),
      );
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });
  });

  describe("エラーハンドリング", () => {
    it("従業員識別子が null の場合は WorkerError(EMPLOYEE_NOT_FOUND)", async () => {
      mockExtractSalaryParams.mockResolvedValue({
        employeeIdentifier: null,
        changeType: "mechanical",
        targetSalary: 260000,
        allowanceType: null,
        reasoning: "",
      });

      await expect(handleSalary("chat-001", makeEvent(), makeIntentResult())).rejects.toThrow(
        expect.objectContaining({ code: "EMPLOYEE_NOT_FOUND", shouldNack: false }),
      );
    });

    it("従業員が見つからない場合は WorkerError(EMPLOYEE_NOT_FOUND)", async () => {
      mockExtractSalaryParams.mockResolvedValue({
        employeeIdentifier: "UNKNOWN",
        changeType: "mechanical",
        targetSalary: 260000,
        allowanceType: null,
        reasoning: "",
      });

      // 両方のクエリで見つからない
      const mockGet = vi.fn().mockResolvedValue({ empty: true, docs: [] });
      mockEmployeesWhere.mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ get: mockGet }) }),
      });

      await expect(handleSalary("chat-001", makeEvent(), makeIntentResult())).rejects.toThrow(
        expect.objectContaining({ code: "EMPLOYEE_NOT_FOUND" }),
      );
    });

    it("extractSalaryParams が失敗した場合は WorkerError(LLM_ERROR, shouldNack=true)", async () => {
      mockExtractSalaryParams.mockRejectedValue(new Error("Vertex AI timeout"));

      await expect(handleSalary("chat-001", makeEvent(), makeIntentResult())).rejects.toThrow(
        expect.objectContaining({ code: "LLM_ERROR", shouldNack: true }),
      );
    });

    it("バッチコミットが失敗した場合は WorkerError(DB_ERROR, shouldNack=true)", async () => {
      mockExtractSalaryParams.mockResolvedValue({
        employeeIdentifier: "E001",
        changeType: "mechanical",
        targetSalary: 260000,
        allowanceType: null,
        reasoning: "2ピッチアップ",
      });
      mockApplyMechanicalChange.mockReturnValue({
        changeType: "mechanical",
        before: MOCK_BREAKDOWN,
        after: MOCK_AFTER_BREAKDOWN,
        items: [],
      });
      mockBatchCommit.mockRejectedValue(new Error("Firestore unavailable"));

      await expect(handleSalary("chat-001", makeEvent(), makeIntentResult())).rejects.toThrow(
        expect.objectContaining({ code: "DB_ERROR", shouldNack: true }),
      );
    });
  });
});
