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

/** メッセージ本文の先頭部分で Google Chat 内検索するURL */
export function buildMessageSearchUrl(content: string): string {
  const query = content.trim().slice(0, 30);
  if (!query) return "";
  return `https://mail.google.com/chat/u/0/#search/${encodeURIComponent(query)}/cmembership=1`;
}
