import type { ResponseStatus } from "@hr-system/shared";

/** カテゴリ日本語ラベル */
export const CATEGORY_LABELS: Record<string, string> = {
  salary: "給与・社保",
  retirement: "退職・休職",
  hiring: "入社・採用",
  contract: "契約変更",
  transfer: "施設・異動",
  foreigner: "外国人・ビザ",
  training: "研修・監査",
  health_check: "健康診断",
  attendance: "勤怠・休暇",
  other: "その他",
};

/** 対応状況ラベル */
export const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  unresponded: "未対応",
  in_progress: "対応中",
  responded: "対応済",
  not_required: "対応不要",
};

/** 対応状況バッジ色（バッジ用: bg-xxx-100 text-xxx-800） */
export const RESPONSE_STATUS_BADGE_COLORS: Record<ResponseStatus, string> = {
  unresponded: "bg-red-100 text-red-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  responded: "bg-green-100 text-green-800",
  not_required: "bg-gray-100 text-gray-600",
};

/** 対応状況ドット色（リスト用: bg-xxx-500） */
export const RESPONSE_STATUS_DOT_COLORS: Record<ResponseStatus, string> = {
  unresponded: "bg-red-500",
  in_progress: "bg-yellow-500",
  responded: "bg-green-500",
  not_required: "bg-gray-400",
};

/** 金額フォーマット */
export function formatCurrency(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}
