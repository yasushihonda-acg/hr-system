import type { ActorRole, ChangeType, DraftStatus } from "./types.js";
import { VALID_TRANSITIONS } from "./types.js";

/**
 * 遷移ごとの許可ロールマトリックス
 * キー: "from→to" 形式
 */
const TRANSITION_ROLES: Record<string, readonly (ActorRole | "system")[]> = {
  "draft→reviewed": ["hr_staff", "hr_manager"],
  "draft→rejected": ["hr_staff", "hr_manager"],
  "reviewed→approved": ["hr_manager"],
  "reviewed→pending_ceo_approval": ["hr_manager"],
  "reviewed→draft": ["hr_staff", "hr_manager"],
  "pending_ceo_approval→approved": ["ceo"],
  "pending_ceo_approval→draft": ["ceo"],
  "rejected→draft": ["hr_staff", "hr_manager"],
  "approved→processing": ["system"],
  "processing→completed": ["system"],
  "processing→failed": ["system"],
  "failed→processing": ["hr_staff", "hr_manager"],
  "failed→reviewed": ["hr_manager"],
};

/**
 * changeType 制約がある遷移
 * 制約がない遷移はここに含めない
 */
const CHANGE_TYPE_CONSTRAINTS: Record<string, ChangeType> = {
  "reviewed→approved": "mechanical",
  "reviewed→pending_ceo_approval": "discretionary",
};

/**
 * ステータス遷移を検証する
 *
 * 検証順序:
 * 1. VALID_TRANSITIONS に存在する遷移か
 * 2. ロールに権限があるか
 * 3. changeType 制約を満たすか
 */
export function validateTransition(
  from: DraftStatus,
  to: DraftStatus,
  actorRole: ActorRole | "system",
  changeType: ChangeType,
): { valid: boolean; error?: string } {
  // 1. 遷移自体が有効か
  const validTargets = VALID_TRANSITIONS[from];
  if (!validTargets.includes(to)) {
    return { valid: false, error: `Invalid transition: ${from} → ${to}` };
  }

  const key = `${from}→${to}`;

  // 2. ロール権限チェック
  const allowedRoles = TRANSITION_ROLES[key];
  if (!allowedRoles?.includes(actorRole)) {
    return {
      valid: false,
      error: `Role ${actorRole} is not allowed to transition from ${from} to ${to}`,
    };
  }

  // 3. changeType 制約チェック
  const requiredChangeType = CHANGE_TYPE_CONSTRAINTS[key];
  if (requiredChangeType && changeType !== requiredChangeType) {
    return {
      valid: false,
      error: `Transition ${from} → ${to} requires changeType ${requiredChangeType}`,
    };
  }

  return { valid: true };
}

/**
 * 現在のステータス・ロール・変更種別から実行可能な遷移先を返す
 */
export function getNextActions(
  current: DraftStatus,
  actorRole: ActorRole | "system",
  changeType: ChangeType,
): DraftStatus[] {
  const candidates = VALID_TRANSITIONS[current];
  return candidates.filter((to) => validateTransition(current, to, actorRole, changeType).valid);
}
