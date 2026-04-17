#!/usr/bin/env node
/**
 * HTTP エントリポイント — Cloud Run / ローカル開発用
 *
 * 環境変数:
 *   SMARTHR_API_KEY (必須)
 *   SMARTHR_TENANT_ID (必須)
 *   GOOGLE_CLIENT_ID (必須)
 *   ALLOWED_DOMAIN (任意, デフォルト: aozora-cg.com)
 *   EXTERNAL_READONLY_EMAIL_ALLOWLIST (任意) — 外部 readonly 例外メール（カンマ区切り）
 *   PORT (任意, デフォルト: 8080)
 */

import type { UserStore } from "./core/middleware/auth.js";
import { FirestoreUserStore } from "./core/stores/firestore-user-store.js";
import { parseExternalAllowlist, startHttp } from "./shells/http.js";

/** UserStore を環境変数で切り替え */
function createUserStore(): UserStore {
  if (process.env.USE_FIRESTORE_USER_STORE === "true") {
    console.log(
      JSON.stringify({
        severity: "INFO",
        message: "Using Firestore UserStore",
        source: "mcp-smarthr",
      }),
    );
    return new FirestoreUserStore();
  }

  // フォールバック: 全ドメイン内ユーザーを readonly として許可（開発/デモ用）
  console.log(
    JSON.stringify({
      severity: "WARNING",
      message:
        "Using in-memory UserStore — all domain users get readonly access. Set USE_FIRESTORE_USER_STORE=true for production.",
      source: "mcp-smarthr",
    }),
  );
  return {
    async getUser(_email: string) {
      return { role: "readonly" as const, enabled: true };
    },
  };
}

const userStore = createUserStore();

const apiKey = process.env.SMARTHR_API_KEY;
const tenantId = process.env.SMARTHR_TENANT_ID;
const googleClientId = process.env.GOOGLE_CLIENT_ID;

if (!apiKey || !tenantId || !googleClientId) {
  console.error(
    "Error: SMARTHR_API_KEY, SMARTHR_TENANT_ID, and GOOGLE_CLIENT_ID environment variables are required.",
  );
  process.exit(1);
}

// OAuth 設定（環境変数が揃っている場合のみ有効化）
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const jwtSecret = process.env.JWT_SECRET;
const serverUrl = process.env.SERVER_URL;

const oauthEnabled = !!(googleClientSecret && jwtSecret && serverUrl);
if (oauthEnabled) {
  console.log(
    JSON.stringify({
      severity: "INFO",
      message: "OAuth 2.1 mode enabled",
      serverUrl,
      source: "mcp-smarthr",
    }),
  );
}

const allowedDomain = process.env.ALLOWED_DOMAIN ?? "aozora-cg.com";

// 外部 readonly 例外メールのパース（起動時ガード込み、パース失敗時は起動エラー）
let externalAllowlist: readonly string[] = [];
try {
  externalAllowlist = parseExternalAllowlist(
    process.env.EXTERNAL_READONLY_EMAIL_ALLOWLIST,
    allowedDomain,
  );
  if (externalAllowlist.length > 0) {
    console.log(
      JSON.stringify({
        severity: "INFO",
        message: "EXTERNAL_READONLY_EMAIL_ALLOWLIST loaded",
        count: externalAllowlist.length,
        source: "mcp-smarthr",
      }),
    );
  }
} catch (error) {
  console.error(
    JSON.stringify({
      severity: "CRITICAL",
      message: "Failed to parse EXTERNAL_READONLY_EMAIL_ALLOWLIST",
      error: error instanceof Error ? error.message : String(error),
      source: "mcp-smarthr",
    }),
  );
  process.exit(1);
}

startHttp({
  smarthrApiKey: apiKey,
  smarthrTenantId: tenantId,
  googleClientId,
  allowedDomain,
  externalAllowlist,
  userStore,
  port: Number(process.env.PORT) || 8080,
  authDisabled: process.env.AUTH_DISABLED === "true",
  ipRestrictionEnabled: process.env.IP_RESTRICTION_ENABLED === "true",
  oauth:
    oauthEnabled && googleClientSecret && jwtSecret && serverUrl
      ? {
          googleClientSecret,
          jwtSecret,
          serverUrl,
          jwtExpiresIn: Number(process.env.JWT_EXPIRES_IN) || 3600,
        }
      : undefined,
}).catch((error) => {
  console.error(
    JSON.stringify({
      severity: "CRITICAL",
      message: "MCP HTTP server failed to start",
      error: error instanceof Error ? error.message : String(error),
      source: "mcp-smarthr",
    }),
  );
  process.exit(1);
});
