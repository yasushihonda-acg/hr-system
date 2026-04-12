/**
 * 4 層認証・認可ミドルウェア
 *
 * Layer 1: トランスポート認証（Shell 層で処理、Core には AuthContext として渡る）
 * Layer 2: ドメイン検証（aozora-cg.com）
 * Layer 3: ユーザー許可リスト（UserStore 経由）
 * Layer 4: ツール権限（ロール別アクセス制御）
 *
 * トランスポート非依存: stdio / HTTP 両方で利用可能。
 */

// Role は pii-filter.ts で定義済み — 重複を避けて re-export
export type { Role } from "./pii-filter.js";

import type { ToolName } from "../tools.js";
import type { Role } from "./pii-filter.js";

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
  getUser(email: string): Promise<{ role: Role; enabled: boolean } | null>;
}

/** ツール権限マッピング（defineTools の全ツールに対応を強制） */
export const TOOL_PERMISSIONS: Record<ToolName, Role> = {
  list_employees: "readonly",
  get_employee: "readonly",
  search_employees: "readonly",
  get_pay_statements: "admin",
  list_departments: "readonly",
  list_positions: "readonly",
};

/** 認可チェック結果 */
export interface AuthResult {
  authorized: boolean;
  role: Role;
  email: string;
  /** 拒否理由 */
  reason?: string;
}

/** ロール階層: admin は readonly の権限を包含する */
function hasPermission(userRole: Role, requiredRole: Role): boolean {
  if (userRole === "admin") return true;
  return userRole === requiredRole;
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
    const requiredRole = TOOL_PERMISSIONS[toolName as ToolName];
    if (!requiredRole) {
      return {
        authorized: false,
        role: user.role,
        email: context.email,
        reason: "未登録ツール",
      };
    }
    if (!hasPermission(user.role, requiredRole)) {
      return {
        authorized: false,
        role: user.role,
        email: context.email,
        reason: "権限不足",
      };
    }

    return {
      authorized: true,
      role: user.role,
      email: context.email,
    };
  }

  /** stdio トランスポート用: 許可リストを尊重、未登録は readonly（H2修正） */
  private async authorizeStdio(context: AuthContext, toolName: string): Promise<AuthResult> {
    const user = await this.userStore.getUser(context.email);
    // H2修正: 未登録ユーザーは readonly（admin にしない）
    const role: Role = user?.role ?? "readonly";

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
    const requiredRole = TOOL_PERMISSIONS[toolName as ToolName];
    if (!requiredRole) {
      return {
        authorized: false,
        role,
        email: context.email,
        reason: "未登録ツール",
      };
    }
    if (!hasPermission(role, requiredRole)) {
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
