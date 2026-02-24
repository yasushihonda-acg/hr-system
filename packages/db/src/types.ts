import type {
  ActorRole,
  AllowanceType,
  ApprovalAction,
  AuditEventType,
  ChangeType,
  ChatCategory,
  DraftStatus,
  EmploymentType,
  ResponseStatus,
  SalaryItemType,
  UserRole,
  WorkflowSteps,
} from "@hr-system/shared";
import type { Timestamp } from "firebase-admin/firestore";

/** 従業員マスタ */
export interface Employee {
  employeeNumber: string;
  name: string;
  email: string | null;
  googleChatUserId: string | null;
  employmentType: EmploymentType;
  department: string | null;
  position: string | null;
  hireDate: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 現行給与 */
export interface Salary {
  employeeId: string;
  baseSalary: number;
  positionAllowance: number;
  regionAllowance: number;
  qualificationAllowance: number;
  otherAllowance: number;
  totalSalary: number;
  effectiveFrom: Timestamp;
  effectiveTo: Timestamp | null;
  createdAt: Timestamp;
}

/** AI生成の給与変更ドラフト */
export interface SalaryDraft {
  employeeId: string;
  chatMessageId: string | null;
  status: DraftStatus;
  changeType: ChangeType;
  reason: string | null;
  beforeBaseSalary: number;
  afterBaseSalary: number;
  beforeTotal: number;
  afterTotal: number;
  effectiveDate: Timestamp;
  aiConfidence: number | null;
  aiReasoning: string | null;
  appliedRules: Record<string, unknown> | null;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  approvedBy: string | null;
  approvedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** ドラフト明細（手当項目ごとの Before/After） */
export interface SalaryDraftItem {
  draftId: string;
  itemType: SalaryItemType;
  itemName: string;
  beforeAmount: number;
  afterAmount: number;
  isChanged: boolean;
}

/** Chat メッセージ内のメンション・リンク・スラッシュコマンド等のアノテーション */
export interface ChatAnnotation {
  type: "USER_MENTION" | "SLASH_COMMAND" | "RICH_LINK" | "UNKNOWN";
  startIndex?: number;
  length?: number;
  userMention?: {
    user: { name: string; displayName: string; type: string };
  };
  slashCommand?: {
    commandId: string;
    commandName: string;
  };
  richLink?: {
    uri: string;
    title?: string;
  };
}

/** Chat メッセージの添付ファイル */
export interface ChatAttachment {
  name: string;
  contentName?: string;
  contentType?: string;
  downloadUri?: string;
  source?: "DRIVE_FILE" | "UPLOADED_CONTENT";
}

/** チャットメッセージ */
export interface ChatMessage {
  spaceId: string;
  googleMessageId: string;
  /** Phase 1: Chat userId ("users/{id}") を保存。Phase 2: People API で実名メールに置換 */
  senderUserId: string;
  senderEmail: string;
  senderName: string;
  senderType: "HUMAN" | "BOT";
  /** プレーンテキスト */
  content: string;
  /** リッチテキスト（マークアップ付き）。未取得の場合は null */
  formattedContent: string | null;
  /** "MESSAGE": 通常投稿 / "THREAD_REPLY": スレッド返信 */
  messageType: "MESSAGE" | "THREAD_REPLY";
  /** スレッドリソース名 "spaces/.../threads/..." */
  threadName: string | null;
  /** スレッド返信の場合の親メッセージリソース名 */
  parentMessageId: string | null;
  /** @メンションされたユーザー一覧 */
  mentionedUsers: Array<{ userId: string; displayName: string }>;
  /** リンク・メンション・スラッシュコマンド等のアノテーション */
  annotations: ChatAnnotation[];
  /** 添付ファイル */
  attachments: ChatAttachment[];
  /** 編集済みフラグ */
  isEdited: boolean;
  /** 削除済みフラグ */
  isDeleted: boolean;
  /** 生ペイロード（将来の再解析用） */
  rawPayload: Record<string, unknown> | null;
  processedAt: Timestamp | null;
  createdAt: Timestamp;
}

/** AI Intent 分類結果 */
export interface IntentRecord {
  chatMessageId: string;
  category: ChatCategory;
  confidenceScore: number;
  extractedParams: Record<string, unknown> | null;
  /** 分類方法: "regex"=正規表現, "ai"=LLM, "manual"=人手修正 */
  classificationMethod: "ai" | "regex" | "manual";
  /** regex 分類の場合にマッチしたパターン名 */
  regexPattern: string | null;
  llmInput: string | null;
  llmOutput: string | null;
  /** 手動修正フラグ */
  isManualOverride: boolean;
  /** 修正前のカテゴリ（手動修正時のみ） */
  originalCategory: ChatCategory | null;
  /** 修正者 email */
  overriddenBy: string | null;
  overriddenAt: Timestamp | null;
  /** HR チームの対応状況 */
  responseStatus: ResponseStatus;
  /** 対応状況を更新した人の email */
  responseStatusUpdatedBy: string | null;
  responseStatusUpdatedAt: Timestamp | null;
  /** 「作成案」タスク管理フィールド */
  taskSummary: string | null;
  assignees: string | null;
  notes: string | null;
  workflowSteps: WorkflowSteps | null;
  workflowUpdatedBy: string | null;
  workflowUpdatedAt: Timestamp | null;
  createdAt: Timestamp;
}

/** 承認ワークフロー履歴 */
export interface ApprovalLog {
  draftId: string;
  action: ApprovalAction;
  fromStatus: DraftStatus;
  toStatus: DraftStatus;
  actorEmail: string;
  actorRole: ActorRole;
  comment: string | null;
  modifiedFields: Record<string, unknown> | null;
  createdAt: Timestamp;
}

/** 監査ログ（全操作の不変記録） */
export interface AuditLog {
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  actorEmail: string | null;
  actorRole: ActorRole | null;
  details: Record<string, unknown>;
  createdAt: Timestamp;
}

/** Pitchテーブル（マスタ） */
export interface PitchTable {
  grade: number;
  step: number;
  amount: number;
  isActive: boolean;
  createdAt: Timestamp;
}

/** 手当マスタ */
export interface AllowanceMaster {
  allowanceType: AllowanceType;
  code: string;
  name: string;
  amount: number;
  isActive: boolean;
  createdAt: Timestamp;
}

/** ダッシュボードアクセス許可ユーザー */
export interface AllowedUser {
  email: string;
  displayName: string;
  role: UserRole;
  addedBy: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 同期メタデータ */
export interface SyncMetadata {
  lastSyncedAt: Timestamp | null;
  status: "idle" | "running" | "error";
  lastResult: {
    newMessages: number;
    duplicateSkipped: number;
    durationMs: number;
    syncedAt: Timestamp;
  } | null;
  errorMessage: string | null;
  updatedAt: Timestamp;
}

/** Chat定期同期設定 */
export interface ChatSyncConfig {
  intervalMinutes: number;
  isEnabled: boolean;
  updatedAt: Timestamp;
  updatedBy: string;
}

/** AI分類ルール */
export interface ClassificationRule {
  category: ChatCategory;
  keywords: string[];
  excludeKeywords: string[];
  patterns: string[];
  priority: number;
  description: string;
  confidenceScore: number;
  isActive: boolean;
  sampleMessages: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** チャットスペース設定 */
export interface ChatSpaceConfig {
  spaceId: string;
  displayName: string;
  isActive: boolean;
  addedBy: string;
  updatedBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** LLM分類ルール（システムプロンプト・Few-shot例） */
export interface LlmClassificationRule {
  type: "system_prompt" | "few_shot_example" | "category_definition";
  content: string | null;
  category: ChatCategory | null;
  description: string | null;
  keywords: string[] | null;
  inputText: string | null;
  expectedCategory: ChatCategory | null;
  explanation: string | null;
  priority: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
