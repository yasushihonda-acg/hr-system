/**
 * 4 層認証・認可ミドルウェア
 *
 * Layer 1: トランスポート認証（Shell 層で処理、Core には AuthContext として渡る）
 * Layer 2: ドメイン検証（aozora-cg.com）
 * Layer 3: ユーザー許可リスト（UserStore 経由）
 * Layer 4: ツール権限（パーミッションベースのアクセス制御）
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

/** 認可チェッカー */
export class Authorizer {
  constructor(
    private readonly allowedDomain: string,
    private readonly userStore: UserStore,
  ) {}

  /** 全レイヤーをチェック */
  async authorize(context: AuthContext, toolName: string): Promise<AuthResult> {
    // stdio トランスポートの場合: Layer 2-3 はスキップ
    if (context.transport === "stdio") {
      return this.authorizeStdio(context, toolName);
    }

    // --- HTTP トランスポート: 全 Layer を検証 ---

    // Layer 2: ドメイン検証
    if (context.domain !== this.allowedDomain) {
      return {
        authorized: false,
        role: "readonly",
        email: context.email,
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
        reason: "許可リスト",
      };
    }

    if (!user.enabled) {
      return {
        authorized: false,
        role: user.role,
        email: context.email,
        reason: "無効化されたユーザー",
      };
    }

    // Layer 4: ツール権限（未登録ツールは deny）
    const requiredPermission = TOOL_PERMISSIONS[toolName as ToolName];
    if (!requiredPermission) {
      return {
        authorized: false,
        role: user.role,
        email: context.email,
        reason: "未登録ツール",
      };
    }
    const userPermissions = resolvePermissions(user);
    if (!hasPermission(userPermissions, requiredPermission)) {
      return {
        authorized: false,
        role: deriveRole(userPermissions),
        email: context.email,
        reason: "権限不足",
      };
    }

    return {
      authorized: true,
      role: deriveRole(userPermissions),
      email: context.email,
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
