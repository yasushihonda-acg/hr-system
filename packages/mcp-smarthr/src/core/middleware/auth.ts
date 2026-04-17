/**
 * 4 層認証・認可ミドルウェア
 *
 * Layer 1: トランスポート認証（Shell 層で処理、Core には AuthContext として渡る）
 * Layer 2: アイデンティティ検証（ドメイン一致 OR 外部 readonly 例外メール完全一致）
 * Layer 3: ユーザー許可リスト（UserStore 経由）
 * Layer 4: ツール権限（パーミッションベースのアクセス制御）
 *
 * 外部例外ユーザーには readonly 強制（admin / write / pay_statements 不可）。
 * Firestore 誤設定で write 権限が付与されても deny する最終防衛線として機能する。
 *
 * トランスポート非依存: stdio / HTTP 両方で利用可能。
 */

// Role, Permission は pii-filter.ts で定義済み — 重複を避けて re-export
export type { Permission, Role } from "./pii-filter.js";

import type { ToolName } from "../tools.js";
import type { Permission, Role } from "./pii-filter.js";
import { ROLE_TO_PERMISSIONS } from "./pii-filter.js";

/** Shell 層から渡される認証コンテキスト */
export interface AuthContext {
  readonly email: string;
  /** email から自動導出されたドメイン部分（hd クレームがある場合はそちらを優先） */
  readonly domain: string;
  readonly transport: "stdio" | "http";
}

/**
 * AuthContext を生成するファクトリ関数。
 * domain は email から自動導出し、email/domain の不整合を防止する。
 * HTTP トランスポートで hd クレームを優先する場合は hdOverride を指定する。
 */
export function createAuthContext(
  email: string,
  transport: "stdio" | "http",
  hdOverride?: string,
): AuthContext {
  if (!email.includes("@")) {
    throw new Error(`Invalid email format: ${email}`);
  }
  const emailDomain = email.split("@")[1] ?? "";
  const domain = hdOverride ?? emailDomain;
  return Object.freeze({ email, domain, transport });
}

/** Layer 2 アイデンティティ判定の通過経路 */
export type AllowedBy = "domain" | "external_email_exception" | "denied";

/**
 * Layer 2 アイデンティティ判定（共通関数）。
 *
 * 判定順: domain 完全一致 → external_email_exception 完全一致（小文字正規化） → denied。
 * domain 判定を優先するため、誤って外部 allowlist に domain ユーザーが混入しても
 * domain 経由として扱われる。
 */
export function isAllowedIdentity(
  email: string,
  domain: string,
  allowedDomain: string,
  externalAllowlist: readonly string[],
): AllowedBy {
  if (domain === allowedDomain) return "domain";
  const normalized = email.trim().toLowerCase();
  const matched = externalAllowlist.some((entry) => entry.trim().toLowerCase() === normalized);
  return matched ? "external_email_exception" : "denied";
}

/** ユーザー許可リスト（DI） */
export interface UserStore {
  getUser(
    email: string,
  ): Promise<{ role: Role; permissions?: Permission[]; enabled: boolean } | null>;
}

/** ツール権限マッピング（defineTools の全ツールに対応を強制） */
export const TOOL_PERMISSIONS: Record<ToolName, Permission> = {
  list_employees: "read",
  get_employee: "read",
  search_employees: "read",
  get_pay_statements: "pay_statements",
  list_departments: "read",
  list_positions: "read",
  update_employee: "write",
  create_employee: "write",
};

/** 認可チェック結果 */
export interface AuthResult {
  authorized: boolean;
  role: Role;
  email: string;
  /** Layer 2 の通過経路（stdio は Layer 2 スキップのため未設定のことがある） */
  allowedBy?: AllowedBy;
  /** 拒否理由 */
  reason?: string;
}

const VALID_PERMISSIONS = new Set<string>(["read", "write", "pay_statements"]);

/** ユーザーの実効パーミッションを解決する（permissions フィールド優先、なければ role から導出） */
function resolvePermissions(user: { role: Role; permissions?: Permission[] }): Permission[] {
  if (!user.permissions || !Array.isArray(user.permissions)) {
    return ROLE_TO_PERMISSIONS[user.role];
  }
  const valid = user.permissions.filter((p): p is Permission => VALID_PERMISSIONS.has(p));
  return valid.length > 0 ? valid : ROLE_TO_PERMISSIONS[user.role];
}

/** パーミッションベースのアクセス判定 */
function hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
  return userPermissions.includes(requiredPermission);
}

/** PII フィルタ用のロールを導出（pay_statements + write の両方があれば admin 扱い） */
function deriveRole(permissions: Permission[]): Role {
  return permissions.includes("pay_statements") && permissions.includes("write")
    ? "admin"
    : "readonly";
}

/**
 * 外部例外ユーザーの readonly 制約チェック。
 * role が admin、または permissions に write / pay_statements が含まれていたら違反。
 * Firestore 誤設定で外部メールに write 権限が付与された場合の最終防衛線。
 */
export function isExternalReadonlyViolation(user: {
  role: Role;
  permissions?: Permission[];
}): boolean {
  if (user.role !== "readonly") return true;
  if (user.permissions) {
    return user.permissions.some((p) => p === "write" || p === "pay_statements");
  }
  return false;
}

/** 認可チェッカー */
export class Authorizer {
  constructor(
    private readonly allowedDomain: string,
    private readonly userStore: UserStore,
    private readonly externalAllowlist: readonly string[] = [],
  ) {}

  /** 全レイヤーをチェック */
  async authorize(context: AuthContext, toolName: string): Promise<AuthResult> {
    // stdio トランスポートの場合: Layer 2 はスキップ、外部例外 readonly 制約は適用
    if (context.transport === "stdio") {
      return this.authorizeStdio(context, toolName);
    }

    // --- HTTP トランスポート: 全 Layer を検証 ---

    // Layer 2: アイデンティティ検証（ドメイン一致 OR 外部例外メール）
    const allowedBy = isAllowedIdentity(
      context.email,
      context.domain,
      this.allowedDomain,
      this.externalAllowlist,
    );
    if (allowedBy === "denied") {
      return {
        authorized: false,
        role: "readonly",
        email: context.email,
        allowedBy,
        reason: "ドメイン制限",
      };
    }

    // Layer 3: ユーザー許可リスト
    const user = await this.userStore.getUser(context.email);
    if (!user) {
      return {
        authorized: false,
        role: "readonly",
        email: context.email,
        allowedBy,
        reason: "許可リスト",
      };
    }

    if (!user.enabled) {
      return {
        authorized: false,
        role: user.role,
        email: context.email,
        allowedBy,
        reason: "無効化されたユーザー",
      };
    }

    // Layer 3.5: 外部例外ユーザーの readonly 強制
    if (allowedBy === "external_email_exception" && isExternalReadonlyViolation(user)) {
      return {
        authorized: false,
        role: "readonly",
        email: context.email,
        allowedBy,
        reason: "外部例外は readonly 固定",
      };
    }

    // Layer 4: ツール権限（未登録ツールは deny）
    const requiredPermission = TOOL_PERMISSIONS[toolName as ToolName];
    if (!requiredPermission) {
      return {
        authorized: false,
        role: user.role,
        email: context.email,
        allowedBy,
        reason: "未登録ツール",
      };
    }
    const userPermissions = resolvePermissions(user);
    if (!hasPermission(userPermissions, requiredPermission)) {
      return {
        authorized: false,
        role: deriveRole(userPermissions),
        email: context.email,
        allowedBy,
        reason: "権限不足",
      };
    }

    return {
      authorized: true,
      role: deriveRole(userPermissions),
      email: context.email,
      allowedBy,
    };
  }

  /** stdio トランスポート用: 許可リストを尊重、未登録は readonly（H2修正） */
  private async authorizeStdio(context: AuthContext, toolName: string): Promise<AuthResult> {
    const user = await this.userStore.getUser(context.email);
    // H2修正: 未登録ユーザーは readonly パーミッション
    const userPermissions = user ? resolvePermissions(user) : ROLE_TO_PERMISSIONS.readonly;
    const role = deriveRole(userPermissions);

    // H2修正: enabled チェックも stdio で実施
    if (user && !user.enabled) {
      return {
        authorized: false,
        role,
        email: context.email,
        reason: "無効化されたユーザー",
      };
    }

    // 外部例外ユーザーの readonly 強制（stdio でも最終防衛線として適用）
    const normalized = context.email.trim().toLowerCase();
    const isExternal = this.externalAllowlist.some(
      (entry) => entry.trim().toLowerCase() === normalized,
    );
    if (isExternal && user && isExternalReadonlyViolation(user)) {
      return {
        authorized: false,
        role: "readonly",
        email: context.email,
        allowedBy: "external_email_exception",
        reason: "外部例外は readonly 固定",
      };
    }

    // 未登録ツールは deny
    const requiredPermission = TOOL_PERMISSIONS[toolName as ToolName];
    if (!requiredPermission) {
      return {
        authorized: false,
        role,
        email: context.email,
        reason: "未登録ツール",
      };
    }
    if (!hasPermission(userPermissions, requiredPermission)) {
      return {
        authorized: false,
        role,
        email: context.email,
        reason: "権限不足",
      };
    }

    return {
      authorized: true,
      role,
      email: context.email,
    };
  }
}
