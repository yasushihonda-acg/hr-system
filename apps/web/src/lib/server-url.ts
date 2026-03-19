import { headers } from "next/headers";

/**
 * リクエストヘッダーから baseUrl を構築する。
 * Cloud Run では x-forwarded-* ヘッダーが自動注入される。
 * ローカル開発時は host ヘッダーにフォールバック。
 */
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3005";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
