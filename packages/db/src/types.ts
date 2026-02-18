import type { ActorRole, ChangeType, ChatCategory, DraftStatus } from "@hr-system/shared";
import type { Timestamp } from "firebase-admin/firestore";

/** 従業員マスタ */
export interface Employee {
  employeeNumber: string;
  name: string;
  email: string | null;
  employmentType: "full_time" | "part_time" | "visiting_nurse";
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
  qualAllowance: number;
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
  beforeSnapshot: Record<string, unknown>;
  afterSnapshot: Record<string, unknown>;
  aiConfidence: number | null;
  aiReasoning: string | null;
  effectiveDate: Timestamp;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  approvedBy: string | null;
  approvedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** チャットメッセージ + AI分類結果 */
export interface ChatMessage {
  spaceId: string;
  googleMessageId: string;
  senderEmail: string;
  senderName: string;
  content: string;
  category: ChatCategory;
  aiParsed: Record<string, unknown> | null;
  processedAt: Timestamp | null;
  createdAt: Timestamp;
}

/** 承認ワークフロー履歴 */
export interface ApprovalLog {
  draftId: string;
  fromStatus: string;
  toStatus: string;
  actorEmail: string;
  actorRole: ActorRole;
  comment: string | null;
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
  allowanceType: "position" | "region" | "qualification";
  code: string;
  name: string;
  amount: number;
  isActive: boolean;
  createdAt: Timestamp;
}
