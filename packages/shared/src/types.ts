/** ドラフトステータス (ADR-006 + PRD 状態遷移図) */
export const DRAFT_STATUSES = [
  "draft",
  "reviewed",
  "pending_ceo_approval",
  "approved",
  "processing",
  "completed",
  "rejected",
  "failed",
] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

/** 終端ステータス（遷移先なし） */
export const TERMINAL_STATUSES: readonly DraftStatus[] = ["completed"] as const;

/**
 * 有効なステータス遷移マップ (ADR-006 + PRD)
 *
 * 機械的変更: draft → reviewed → approved → processing → completed
 * 裁量的変更: draft → reviewed → pending_ceo_approval → approved → processing → completed
 * 差戻し: rejected → draft, pending_ceo_approval → draft, reviewed → draft
 * 処理失敗: processing → failed, failed → processing (リトライ) or → reviewed (手動介入)
 */
export const VALID_TRANSITIONS: Record<DraftStatus, readonly DraftStatus[]> = {
  draft: ["reviewed", "rejected"],
  reviewed: ["approved", "pending_ceo_approval", "draft"],
  pending_ceo_approval: ["approved", "draft"],
  approved: ["processing"],
  processing: ["completed", "failed"],
  completed: [],
  rejected: ["draft"],
  failed: ["processing", "reviewed"],
} as const;

/** 変更種別 (ADR-006) */
export const CHANGE_TYPES = ["mechanical", "discretionary"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

/** チャットメッセージカテゴリ (10カテゴリ) */
export const CHAT_CATEGORIES = [
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
] as const;
export type ChatCategory = (typeof CHAT_CATEGORIES)[number];

/** 承認者ロール */
export const ACTOR_ROLES = ["hr_staff", "hr_manager", "ceo"] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

/** 雇用区分 */
export const EMPLOYMENT_TYPES = ["full_time", "part_time", "visiting_nurse"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/** 手当種別 */
export const ALLOWANCE_TYPES = ["position", "region", "qualification"] as const;
export type AllowanceType = (typeof ALLOWANCE_TYPES)[number];

/** 給与項目種別（Before/After 比較用） */
export const SALARY_ITEM_TYPES = [
  "base_salary",
  "position_allowance",
  "region_allowance",
  "qualification_allowance",
  "other_allowance",
] as const;
export type SalaryItemType = (typeof SALARY_ITEM_TYPES)[number];

/** 承認アクション種別 */
export const APPROVAL_ACTIONS = ["reviewed", "approved", "rejected", "modified"] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

/** 監査イベント種別 */
export const AUDIT_EVENT_TYPES = [
  "chat_received",
  "intent_classified",
  "draft_created",
  "draft_modified",
  "status_changed",
  "notification_sent",
  "external_sync",
  "user_added",
  "user_removed",
  "user_updated",
  "classification_rule_changed",
  "response_status_updated",
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/** ダッシュボードユーザーロール */
export const USER_ROLES = ["admin", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** チャットメッセージ対応状況 */
export const RESPONSE_STATUSES = [
  "unresponded",
  "in_progress",
  "responded",
  "not_required",
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];
