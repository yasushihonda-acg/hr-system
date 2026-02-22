import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** メッセージ本文の先頭部分で Google Chat 内検索するURL */
export function buildMessageSearchUrl(content: string): string {
  const query = content.trim().slice(0, 30);
  if (!query) return "";
  return `https://mail.google.com/chat/u/0/#search/${encodeURIComponent(query)}/cmembership=1`;
}
