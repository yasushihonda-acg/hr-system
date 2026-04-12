/**
 * JWT 発行・検証（jose ライブラリ使用）
 *
 * MCP アクセストークンとして使用:
 *   - HS256 署名（シークレットキー）
 *   - 短寿命（デフォルト 1 時間）
 *   - リフレッシュトークンなし（Codex セカンドオピニオンに基づく意図的な制限）
 *   - aud クレームで MCP リソースにバインド（RFC 8707）
 */

import * as jose from "jose";
import type { Role } from "../middleware/pii-filter.js";

export interface McpTokenPayload {
  /** ユーザーメールアドレス */
  email: string;
  /** Google Workspace ドメイン */
  domain: string;
  /** ユーザーロール */
  role: Role;
}

export interface McpTokenClaims extends McpTokenPayload {
  /** Subject（email と同一） */
  sub: string;
  /** Audience（MCP サーバー URL） */
  aud: string;
  /** Issuer（MCP サーバー URL） */
  iss: string;
}

/**
 * MCP アクセストークン（JWT）を発行する。
 */
export async function issueAccessToken(
  payload: McpTokenPayload,
  secret: string,
  options: {
    serverUrl: string;
    expiresIn?: number;
  },
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  const expiresIn = options.expiresIn ?? 3600;

  return new jose.SignJWT({
    email: payload.email,
    domain: payload.domain,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.email)
    .setIssuer(options.serverUrl)
    .setAudience(options.serverUrl)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secretKey);
}

/**
 * MCP アクセストークン（JWT）を検証し、クレームを返す。
 *
 * 検証項目:
 *   - 署名（HS256）
 *   - 有効期限（exp）
 *   - Audience（MCP サーバー URL と一致）
 *   - Issuer（MCP サーバー URL と一致）
 */
export async function verifyAccessToken(
  token: string,
  secret: string,
  serverUrl: string,
): Promise<McpTokenClaims> {
  const secretKey = new TextEncoder().encode(secret);

  const { payload } = await jose.jwtVerify(token, secretKey, {
    issuer: serverUrl,
    audience: serverUrl,
  });

  const email = payload.email as string | undefined;
  const domain = payload.domain as string | undefined;
  const role = payload.role as string | undefined;

  if (!email || !domain || !role) {
    throw new Error("Invalid token: missing required claims (email, domain, role)");
  }

  if (role !== "admin" && role !== "readonly") {
    throw new Error(`Invalid token: invalid role claim: ${role}`);
  }

  return {
    sub: payload.sub ?? email,
    iss: payload.iss ?? serverUrl,
    aud: typeof payload.aud === "string" ? payload.aud : serverUrl,
    email,
    domain,
    role,
  };
}
