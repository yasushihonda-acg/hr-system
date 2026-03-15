/** 許可ドメインのデフォルト値 */
const DEFAULT_ALLOWED_DOMAINS = ["aozora-cg.com", "lend.aozora-cg.com"];

/**
 * 環境変数 ALLOWED_DOMAINS（カンマ区切り）またはデフォルト値から許可ドメイン一覧を取得
 */
export function getAllowedDomains(): string[] {
  const env = typeof process !== "undefined" ? process.env.ALLOWED_DOMAINS : undefined;
  if (env) {
    return env
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_ALLOWED_DOMAINS;
}

/**
 * メールアドレスのドメインが許可リストに含まれるか判定
 */
export function isAllowedDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return getAllowedDomains().includes(domain);
}
