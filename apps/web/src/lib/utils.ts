import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Asia/Tokyo の Date を "MM/DD HH:mm" 形式で返す（SSR/Client で一致する決定的フォーマット） */
export function formatDateTimeJST(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const mm = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mi = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

/** Asia/Tokyo の Date を "MM/DD" 形式で返す（SSR/Client で一致する決定的フォーマット） */
export function formatDateJST(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const mm = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jst.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

/** Asia/Tokyo の Date を "YYYY/MM/DD" 形式で返す */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jst.getUTCDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

/**
 * メッセージ本文から Google Chat 検索クエリを生成する。
 * Google Chat は形態素解析ベースで検索するため、文の途中（助詞など）で
 * 切ると不完全なトークンとなり検索がヒットしない。
 * 句読点・読点で自然に区切り、超過時は末尾ひらがな（助詞）を除去する。
 */
export function buildSearchQuery(content: string, maxLen = 25): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  // 1. 最初の文（句点・改行区切り）
  const firstSentence = trimmed.split(/[。！？\n]/)[0] ?? trimmed;
  if (firstSentence.length <= maxLen) return firstSentence;

  // 2. 最初の節（読点区切り）
  const firstClause = firstSentence.split(/[、,]/)[0] ?? firstSentence;
  if (firstClause.length <= maxLen) return firstClause;

  // 3. maxLen文字で切って末尾ひらがな（助詞・助動詞）を除去
  const sliced = firstClause.slice(0, maxLen);
  return sliced.replace(/[ぁ-ん]+$/, "") || sliced;
}

/**
 * メッセージ本文 + 日付で Google Chat 内検索するURL を生成する。
 * createdAt が指定された場合、after:/before: 演算子で前後1日に絞り込む。
 */
export function buildMessageSearchUrl(content: string, createdAt?: string): string {
  const query = buildSearchQuery(content);
  if (!query) return "";

  // クエリテキストのみエンコード。after:/before: 演算子はエンコードすると
  // Google Chat が解析できず about:blank になるため、そのまま渡す。
  let searchPath = encodeURIComponent(query);
  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) {
      const before = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      const after = new Date(d.getTime() - 24 * 60 * 60 * 1000);
      const fmt = (dt: Date) =>
        `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
      searchPath = `${searchPath} after:${fmt(after)} before:${fmt(before)}`;
    }
  }

  return `https://mail.google.com/chat/u/0/#search/${searchPath}/cmembership=1`;
}
