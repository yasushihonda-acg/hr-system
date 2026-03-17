import type { ChatCategory, ResponseStatus } from "@hr-system/shared";
import { CHAT_CATEGORIES } from "@hr-system/shared";

/** カテゴリ設定（ラベル・色） */
export const CATEGORY_CONFIG: Record<string, { label: string; accent: string; pill: string }> = {
  salary: {
    label: "給与・社保",
    accent: "border-l-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  },
  retirement: {
    label: "退職・休職",
    accent: "border-l-red-500",
    pill: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  },
  hiring: {
    label: "入社・採用",
    accent: "border-l-blue-500",
    pill: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  },
  contract: {
    label: "契約変更",
    accent: "border-l-amber-500",
    pill: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  },
  transfer: {
    label: "施設・異動",
    accent: "border-l-purple-500",
    pill: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200",
  },
  foreigner: {
    label: "外国人・ビザ",
    accent: "border-l-orange-500",
    pill: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
  },
  training: {
    label: "研修・監査",
    accent: "border-l-indigo-500",
    pill: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
  },
  health_check: {
    label: "健康診断",
    accent: "border-l-pink-500",
    pill: "bg-pink-50 text-pink-700 ring-1 ring-inset ring-pink-200",
  },
  attendance: {
    label: "勤怠・休暇",
    accent: "border-l-teal-500",
    pill: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200",
  },
  other: {
    label: "その他",
    accent: "border-l-slate-300",
    pill: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  },
};

/** カテゴリ日本語ラベル（CATEGORY_CONFIGから派生） */
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([k, v]) => [k, v.label]),
);

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

/** 優先度ピル色 */
export const PRIORITY_PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  critical: {
    active: "bg-red-600 text-white ring-2 ring-red-300",
    inactive: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100",
  },
  high: {
    active: "bg-orange-500 text-white ring-2 ring-orange-300",
    inactive: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 hover:bg-orange-100",
  },
  medium: {
    active: "bg-blue-600 text-white ring-2 ring-blue-300",
    inactive: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100",
  },
  low: {
    active: "bg-slate-500 text-white ring-2 ring-slate-300",
    inactive: "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100",
  },
};

/** ソースピル色 */
export const SOURCE_PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  gchat: {
    active: "bg-blue-600 text-white ring-2 ring-blue-300",
    inactive: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100",
  },
  line: {
    active: "bg-emerald-600 text-white ring-2 ring-emerald-300",
    inactive:
      "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100",
  },
  manual: {
    active: "bg-amber-500 text-white ring-2 ring-amber-300",
    inactive: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100",
  },
};

/** 対応状況ピル色（フィルター用） */
export const RESPONSE_STATUS_PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  unresponded: {
    active: "bg-rose-600 text-white ring-2 ring-rose-300",
    inactive: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-100",
  },
  in_progress: {
    active: "bg-amber-500 text-white ring-2 ring-amber-300",
    inactive: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100",
  },
  responded: {
    active: "bg-green-600 text-white ring-2 ring-green-300",
    inactive: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200 hover:bg-green-100",
  },
  not_required: {
    active: "bg-gray-500 text-white ring-2 ring-gray-300",
    inactive: "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-100",
  },
};

/** カテゴリフィルター選択肢（"すべて" + 10カテゴリ） */
export const CATEGORY_OPTIONS: { value: ChatCategory | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  ...CHAT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c })),
];

/** 金額フォーマット */
export function formatCurrency(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}
