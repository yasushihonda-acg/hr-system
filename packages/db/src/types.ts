import type {
  ActorRole,
  AllowanceType,
  ApprovalAction,
  AuditEventType,
  ChangeType,
  ChatCategory,
  DraftStatus,
  EmploymentType,
  SalaryItemType,
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

/** チャットメッセージ */
export interface ChatMessage {
  spaceId: string;
  googleMessageId: string;
  senderEmail: string;
  senderName: string;
  content: string;
  processedAt: Timestamp | null;
  createdAt: Timestamp;
}

/** AI Intent 分類結果 */
export interface IntentRecord {
  chatMessageId: string;
  category: ChatCategory;
  confidenceScore: number;
  extractedParams: Record<string, unknown> | null;
  llmInput: string | null;
  llmOutput: string | null;
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
