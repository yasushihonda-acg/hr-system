/**
 * OAuth 2.1 Authorization Server 設定
 *
 * MCP 仕様準拠:
 *   - RFC 9728: Protected Resource Metadata
 *   - RFC 8414: Authorization Server Metadata
 *   - OAuth 2.1 + PKCE
 *   - Google OIDC への認証委譲
 */

export interface OAuthConfig {
  /** MCP サーバーの公開 URL（例: https://mcp-smarthr-xxx.run.app） */
  serverUrl: string;
  /** Google OAuth Client ID */
  googleClientId: string;
  /** Google OAuth Client Secret */
  googleClientSecret: string;
  /** JWT 署名用シークレット（HS256） */
  jwtSecret: string;
  /** JWT の有効期間（秒）。デフォルト 3600（1時間） */
  jwtExpiresIn?: number;
  /** 許可ドメイン */
  allowedDomain?: string;
}

/** Google OIDC エンドポイント */
export const GOOGLE_OIDC = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  userinfoEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
  issuer: "https://accounts.google.com",
} as const;

/** RFC 9728: Protected Resource Metadata */
export function buildProtectedResourceMetadata(serverUrl: string) {
  const resource = serverUrl.replace(/\/$/, "");
  return {
    resource,
    authorization_servers: [`${resource}`],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp:read", "mcp:write"],
  };
}

/** RFC 8414: Authorization Server Metadata */
export function buildAuthServerMetadata(serverUrl: string) {
  const base = serverUrl.replace(/\/$/, "");
  return {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["mcp:read", "mcp:write"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    client_id_metadata_document_supported: true,
  };
}
