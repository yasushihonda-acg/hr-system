/** ドラフトステータス (ADR-006) */
export const DRAFT_STATUSES = [
  "draft",
  "reviewed",
  "pending_ceo_approval",
  "approved",
  "processing",
  "completed",
  "rejected",
] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

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
