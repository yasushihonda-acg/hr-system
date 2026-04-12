/**
 * PII フィルタリング・マスキングミドルウェア
 *
 * ロール別にレスポンスから機密フィールドを除去し、
 * ログ出力用に PII をマスキングするユーティリティを提供する。
 */

export type Role = "admin" | "readonly";

/** 細粒度パーミッション（ツール単位のアクセス制御に使用） */
export type Permission = "read" | "write" | "pay_statements";

/** ロール → パーミッション変換（permissions フィールドがない既存ユーザー用） */
export const ROLE_TO_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ["read", "write", "pay_statements"],
  readonly: ["read"],
};

/** readonly ロールで除外するフィールド */
const READONLY_EXCLUDED_FIELDS: ReadonlySet<string> = new Set([
  "birth_at",
  "email",
  "gender",
  "bank_accounts",
  "my_number",
  "tel_number",
  "address",
  "resident_card_address",
  "emergency_address",
  "custom_fields",
]);

/** admin ロールで除外するフィールド */
const ADMIN_EXCLUDED_FIELDS: ReadonlySet<string> = new Set(["my_number"]);

/** maskPII で "[REDACTED]" に置換する PII フィールド（全ロール共通） */
const PII_FIELDS: ReadonlySet<string> = new Set([
  "birth_at",
  "email",
  "gender",
  "bank_accounts",
  "my_number",
  "tel_number",
  "address",
  "resident_card_address",
  "emergency_address",
]);

const MAX_DEPTH = 10;

function getExcludedFields(role: Role): ReadonlySet<string> {
  return role === "admin" ? ADMIN_EXCLUDED_FIELDS : READONLY_EXCLUDED_FIELDS;
}

/**
 * ロール別にオブジェクトから機密フィールドを再帰的に除去する。
 * - null/undefined/プリミティブ型はそのまま返す
 * - 配列は各要素を再帰処理
 * - depth 制限（10段階）で無限再帰を防止
 */
export function filterPII<T>(data: T, role: Role): T {
  return filterRecursive(data, getExcludedFields(role), 0) as T;
}

function filterRecursive(
  data: unknown,
  excludedFields: ReadonlySet<string>,
  depth: number,
): unknown {
  if (depth > MAX_DEPTH) return data;
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => filterRecursive(item, excludedFields, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (excludedFields.has(key)) continue;
    result[key] = filterRecursive(value, excludedFields, depth + 1);
  }
  return result;
}

/**
 * ログ出力用に PII フィールドの値を "[REDACTED]" に置換する。
 * - null/undefined/プリミティブ型はそのまま返す
 * - 配列は各要素を再帰処理
 * - depth 制限（10段階）で無限再帰を防止
 */
export function maskPII(obj: unknown): unknown {
  return maskRecursive(obj, 0);
}

function maskRecursive(data: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return data;
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => maskRecursive(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (PII_FIELDS.has(key)) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = maskRecursive(value, depth + 1);
    }
  }
  return result;
}
