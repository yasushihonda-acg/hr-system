#!/usr/bin/env node
/**
 * HTTP エントリポイント — Cloud Run / ローカル開発用
 *
 * 環境変数:
 *   SMARTHR_API_KEY (必須)
 *   SMARTHR_TENANT_ID (必須)
 *   GOOGLE_CLIENT_ID (必須)
 *   ALLOWED_DOMAIN (任意, デフォルト: aozora-cg.com)
 *   PORT (任意, デフォルト: 8080)
 */

import type { UserStore } from "./core/middleware/auth.js";
import { startHttp } from "./shells/http.js";

/** HTTP 用の簡易 UserStore（将来 Firestore に差し替え） */
const httpUserStore: UserStore = {
  async getUser(_email: string) {
    // Phase C で Firestore ベースの実装に差し替え予定
    // 現時点では全ドメイン内ユーザーを readonly として許可
    return { role: "readonly" as const, enabled: true };
  },
};

const apiKey = process.env.SMARTHR_API_KEY;
const tenantId = process.env.SMARTHR_TENANT_ID;
const googleClientId = process.env.GOOGLE_CLIENT_ID;

if (!apiKey || !tenantId || !googleClientId) {
  console.error(
    "Error: SMARTHR_API_KEY, SMARTHR_TENANT_ID, and GOOGLE_CLIENT_ID environment variables are required.",
  );
  process.exit(1);
}

startHttp({
  smarthrApiKey: apiKey,
  smarthrTenantId: tenantId,
  googleClientId,
  allowedDomain: process.env.ALLOWED_DOMAIN ?? "aozora-cg.com",
  userStore: httpUserStore,
  port: Number(process.env.PORT) || 8080,
  authDisabled: process.env.AUTH_DISABLED === "true",
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
