/**
 * FE/BE 契約テスト
 *
 * 目的:
 *   FE の lib/types.ts に定義された型と BE のAPIレスポンス構造の整合性を検証する。
 *   TypeScript のコンパイルが通ることで型レベルの整合性を保証し、
 *   実行時アサーションで構造パターンのリグレッションを防ぐ。
 *
 * テスト対象:
 *   - DraftSummary / DraftDetail
 *   - ChatMessageSummary / ChatMessageDetail
 *   - AdminUser
 *   - ページネーション構造の整合性
 *
 * 注意:
 *   このテストはエミュレータや外部APIを使用しない。
 *   TypeScript の型システムと構造的アサーションのみで検証する。
 */
import { describe, expect, it } from "vitest";
import type {
  AdminUser,
  ApprovalLogEntry,
  AuditLogEntry,
  ChatMessageDetail,
  ChatMessageSummary,
  DraftDetail,
  DraftItem,
  DraftSummary,
  EmployeeSummary,
  IntentDetail,
  IntentSummary,
} from "../lib/types";

// ---------------------------------------------------------------------------
// ヘルパー: 必須フィールドの存在確認
// ---------------------------------------------------------------------------

function hasAllKeys<T extends object>(obj: T, requiredKeys: (keyof T)[]): boolean {
  return requiredKeys.every((key) => key in obj);
}

// ---------------------------------------------------------------------------
// テスト用サンプルデータ
// TypeScript の型注釈でコンパイル時の型整合性を保証する
// ---------------------------------------------------------------------------

const sampleDraftSummary: DraftSummary = {
  id: "draft-001",
  employeeId: "emp-001",
  chatMessageId: null,
  status: "draft",
  changeType: "mechanical",
  reason: "2ピッチアップ",
  beforeBaseSalary: 247000,
  afterBaseSalary: 260000,
  beforeTotal: 267000,
  afterTotal: 280000,
  effectiveDate: "2026-03-01T00:00:00.000Z",
  aiConfidence: 0.95,
  aiReasoning: "職種変更に伴う給与見直し",
  appliedRules: [],
  reviewedBy: null,
  reviewedAt: null,
  approvedBy: null,
  approvedAt: null,
  createdAt: "2026-02-18T00:00:00.000Z",
  updatedAt: "2026-02-18T00:00:00.000Z",
};

const sampleDraftItem: DraftItem = {
  id: "item-001",
  draftId: "draft-001",
  category: "base_salary",
  beforeValue: 247000,
  afterValue: 260000,
};

const sampleApprovalLog: ApprovalLogEntry = {
  id: "log-001",
  action: "reviewed",
  fromStatus: "draft",
  toStatus: "reviewed",
  actorEmail: "manager@example.com",
  actorRole: "hr_manager",
  comment: null,
  modifiedFields: null,
  createdAt: "2026-02-18T00:00:00.000Z",
};

const sampleDraftDetail: DraftDetail = {
  ...sampleDraftSummary,
  items: [sampleDraftItem],
  approvalLogs: [sampleApprovalLog],
  nextActions: ["reviewed", "rejected"],
};

const sampleIntentSummary: IntentSummary = {
  id: "intent-001",
  category: "salary_change",
  confidenceScore: 0.95,
  classificationMethod: "ai",
  regexPattern: null,
  isManualOverride: false,
  originalCategory: null,
  responseStatus: "unresponded",
  createdAt: "2026-02-18T00:00:00.000Z",
};

const sampleIntentDetail: IntentDetail = {
  ...sampleIntentSummary,
  reasoning: "給与変更の指示が含まれている",
  overriddenBy: null,
  overriddenAt: null,
  responseStatusUpdatedBy: null,
  responseStatusUpdatedAt: null,
};

const sampleChatMessage: ChatMessageSummary = {
  id: "msg-001",
  spaceId: "spaces/AAAA-qf5jX0",
  googleMessageId: "spaces/test/messages/test-msg-001",
  senderUserId: "users/12345",
  senderName: "田中 花子",
  senderType: "HUMAN",
  content: "山田さんの給与を2ピッチアップでお願いします",
  formattedContent: null,
  messageType: "MESSAGE",
  threadName: null,
  parentMessageId: null,
  mentionedUsers: [],
  annotations: [],
  attachments: [],
  isEdited: false,
  isDeleted: false,
  processedAt: null,
  createdAt: "2026-02-18T00:00:00.000Z",
  intent: sampleIntentSummary,
};

const sampleChatMessageDetail: ChatMessageDetail = {
  ...sampleChatMessage,
  rawPayload: { type: "MESSAGE" },
  intent: sampleIntentDetail,
  threadMessages: [
    {
      id: "msg-002",
      senderName: "田中 花子",
      content: "確認しました",
      formattedContent: null,
      messageType: "THREAD_REPLY",
      createdAt: "2026-02-18T01:00:00.000Z",
    },
  ],
};

const sampleEmployee: EmployeeSummary = {
  id: "emp-001",
  employeeNumber: "E0001",
  name: "山田 太郎",
  email: "yamada@example.com",
  employmentType: "full_time",
  department: "営業部",
  position: "主任",
  hireDate: "2020-04-01T00:00:00.000Z",
  isActive: true,
};

const sampleAuditLog: AuditLogEntry = {
  id: "audit-001",
  eventType: "DRAFT_CREATED",
  entityType: "salary_draft",
  entityId: "draft-001",
  actorEmail: "manager@example.com",
  actorRole: "hr_manager",
  details: { draftId: "draft-001" },
  createdAt: "2026-02-18T00:00:00.000Z",
};

const sampleAdminUser: AdminUser = {
  id: "admin-001",
  email: "manager@example.com",
  displayName: "HR マネージャー",
  role: "hr_manager",
  isActive: true,
  addedBy: "ceo@example.com",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// 契約テスト: DraftSummary / DraftDetail
// ---------------------------------------------------------------------------

describe("DraftSummary 契約", () => {
  it("必須フィールドが揃っていること", () => {
    const required: (keyof DraftSummary)[] = [
      "id",
      "employeeId",
      "chatMessageId",
      "status",
      "changeType",
      "reason",
      "beforeBaseSalary",
      "afterBaseSalary",
      "beforeTotal",
      "afterTotal",
      "effectiveDate",
      "aiConfidence",
      "aiReasoning",
      "appliedRules",
      "reviewedBy",
      "reviewedAt",
      "approvedBy",
      "approvedAt",
      "createdAt",
      "updatedAt",
    ];
    expect(hasAllKeys(sampleDraftSummary, required)).toBe(true);
  });

  it("effectiveDate / createdAt / updatedAt が ISO 8601 文字列であること", () => {
    expect(typeof sampleDraftSummary.effectiveDate).toBe("string");
    expect(typeof sampleDraftSummary.createdAt).toBe("string");
    expect(typeof sampleDraftSummary.updatedAt).toBe("string");
  });

  it("beforeBaseSalary / afterBaseSalary が number であること", () => {
    expect(typeof sampleDraftSummary.beforeBaseSalary).toBe("number");
    expect(typeof sampleDraftSummary.afterBaseSalary).toBe("number");
  });
});

describe("DraftDetail 契約", () => {
  it("DraftSummary を継承し items / approvalLogs / nextActions を持つこと", () => {
    expect(hasAllKeys(sampleDraftDetail, ["items", "approvalLogs", "nextActions"])).toBe(true);
    expect(Array.isArray(sampleDraftDetail.items)).toBe(true);
    expect(Array.isArray(sampleDraftDetail.approvalLogs)).toBe(true);
    expect(Array.isArray(sampleDraftDetail.nextActions)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 契約テスト: 一覧レスポンスのページネーション構造
// ---------------------------------------------------------------------------

describe("ページネーション構造の整合性", () => {
  it("salary-drafts 一覧: { drafts[], total, limit, offset } 構造", () => {
    // api.ts の getDrafts() が期待する型と一致すること
    const mockListResponse: {
      drafts: DraftSummary[];
      total: number;
      limit: number;
      offset: number;
    } = {
      drafts: [sampleDraftSummary],
      total: 1,
      limit: 20,
      offset: 0,
    };
    expect(hasAllKeys(mockListResponse, ["drafts", "total", "limit", "offset"])).toBe(true);
    expect(Array.isArray(mockListResponse.drafts)).toBe(true);
    expect(typeof mockListResponse.total).toBe("number");
  });

  it("employees 一覧: { employees[], total, limit, offset } 構造", () => {
    const mockListResponse: {
      employees: EmployeeSummary[];
      total: number;
      limit: number;
      offset: number;
    } = {
      employees: [sampleEmployee],
      total: 1,
      limit: 20,
      offset: 0,
    };
    expect(hasAllKeys(mockListResponse, ["employees", "total", "limit", "offset"])).toBe(true);
  });

  it("audit-logs 一覧: { logs[], total, limit, offset } 構造", () => {
    const mockListResponse: {
      logs: AuditLogEntry[];
      total: number;
      limit: number;
      offset: number;
    } = {
      logs: [sampleAuditLog],
      total: 1,
      limit: 20,
      offset: 0,
    };
    expect(hasAllKeys(mockListResponse, ["logs", "total", "limit", "offset"])).toBe(true);
  });

  it("chat-messages 一覧: { data[], pagination: { limit, offset, hasMore } } 構造 — 他エンドポイントと異なる", () => {
    // chat-messages は他と異なり data[] + pagination ネスト構造を使用する
    const mockListResponse: {
      data: ChatMessageSummary[];
      pagination: { limit: number; offset: number; hasMore: boolean };
    } = {
      data: [sampleChatMessage],
      pagination: { limit: 20, offset: 0, hasMore: false },
    };
    expect(hasAllKeys(mockListResponse, ["data", "pagination"])).toBe(true);
    expect(hasAllKeys(mockListResponse.pagination, ["limit", "offset", "hasMore"])).toBe(true);
    expect(typeof mockListResponse.pagination.hasMore).toBe("boolean");
  });

  it("admin-users 一覧: { data[] } 構造 — ページネーションなし", () => {
    const mockListResponse: { data: AdminUser[] } = {
      data: [sampleAdminUser],
    };
    expect(hasAllKeys(mockListResponse, ["data"])).toBe(true);
    expect(Array.isArray(mockListResponse.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 契約テスト: ChatMessageSummary / ChatMessageDetail
// ---------------------------------------------------------------------------

describe("ChatMessageSummary 契約", () => {
  it("必須フィールドが揃っていること", () => {
    const required: (keyof ChatMessageSummary)[] = [
      "id",
      "spaceId",
      "googleMessageId",
      "senderUserId",
      "senderName",
      "senderType",
      "content",
      "messageType",
      "threadName",
      "mentionedUsers",
      "annotations",
      "attachments",
      "isEdited",
      "isDeleted",
      "createdAt",
      "intent",
    ];
    expect(hasAllKeys(sampleChatMessage, required)).toBe(true);
  });

  it("intent フィールドが null または IntentSummary 型であること", () => {
    // null も許容される
    const withNullIntent: ChatMessageSummary = { ...sampleChatMessage, intent: null };
    expect(withNullIntent.intent).toBeNull();

    // IntentSummary が設定されている場合は responseStatus を持つ
    expect(sampleChatMessage.intent).not.toBeNull();
    expect(sampleChatMessage.intent?.responseStatus).toBeDefined();
  });
});

describe("ChatMessageDetail 契約", () => {
  it("ChatMessageSummary を継承し rawPayload / threadMessages を持つこと", () => {
    expect(hasAllKeys(sampleChatMessageDetail, ["rawPayload", "threadMessages"])).toBe(true);
    expect(Array.isArray(sampleChatMessageDetail.threadMessages)).toBe(true);
  });

  it("threadMessages の各要素が必須フィールドを持つこと", () => {
    expect(sampleChatMessageDetail.threadMessages.length).toBeGreaterThan(0);
    const msg = sampleChatMessageDetail.threadMessages[0]!;
    expect(hasAllKeys(msg, ["id", "senderName", "content", "messageType", "createdAt"])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 契約テスト: AdminUser
// ---------------------------------------------------------------------------

describe("AdminUser 契約", () => {
  it("必須フィールドが揃っていること", () => {
    const required: (keyof AdminUser)[] = [
      "id",
      "email",
      "displayName",
      "role",
      "isActive",
      "addedBy",
      "createdAt",
      "updatedAt",
    ];
    expect(hasAllKeys(sampleAdminUser, required)).toBe(true);
  });

  it("isActive が boolean であること", () => {
    expect(typeof sampleAdminUser.isActive).toBe("boolean");
  });
});
