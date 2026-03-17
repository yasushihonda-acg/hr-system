import type { WorkflowStepStatus, WorkflowSteps } from "@/lib/types";

export const STEP_CYCLE: WorkflowStepStatus[] = [
  "undetermined",
  "completed",
  "not_required",
  "pending",
];

export const DEFAULT_STEPS: WorkflowSteps = {
  smartHRReflection: "undetermined",
  noticeExecution: "undetermined",
  laborLawyerShare: "undetermined",
  salaryListReflection: "undetermined",
};

/** ステータスの色分け設定（セル表示 + ドロップダウン選択肢共通） */
export const STEP_STATUS_COLORS: Record<
  WorkflowStepStatus,
  { badge: string; triggerBg: string; text: string }
> = {
  undetermined: {
    badge: "bg-gray-100 text-gray-600",
    triggerBg: "bg-gray-50 border-gray-200",
    text: "text-gray-600",
  },
  not_required: {
    badge: "bg-blue-100 text-blue-700",
    triggerBg: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
  },
  completed: {
    badge: "bg-green-100 text-green-700",
    triggerBg: "bg-green-50 border-green-200",
    text: "text-green-700",
  },
  pending: {
    badge: "bg-red-100 text-red-700",
    triggerBg: "bg-red-50 border-red-200",
    text: "text-red-700",
  },
};

/** テーブルセル用の共通スタイル（列に依存しないアイコン・色） — 後方互換用 */
export const STEP_CONFIG: Record<WorkflowStepStatus, { label: string; cls: string }> = {
  undetermined: { label: "ー", cls: "text-muted-foreground bg-muted/50 border border-border" },
  completed: {
    label: "✓",
    cls: "text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold",
  },
  not_required: {
    label: "✗",
    cls: "text-muted-foreground bg-muted border border-border line-through",
  },
  pending: {
    label: "!",
    cls: "text-red-700 bg-red-50 border border-red-200 font-bold",
  },
};

/** 表示順序: ❶SmartHR更新 → ❷本人通知 → ❸社労士共有 → ❹給与DB反映 */
export const STEP_KEYS = [
  "smartHRReflection",
  "noticeExecution",
  "laborLawyerShare",
  "salaryListReflection",
] as const;

/** 列ごとのステータスラベル（スプレッドシート準拠） */
export const STEP_STATUS_LABELS: Record<keyof WorkflowSteps, Record<WorkflowStepStatus, string>> = {
  smartHRReflection: {
    undetermined: "未判定",
    not_required: "反映不要と判定",
    completed: "要反映で反映済み",
    pending: "要対応で未反映",
  },
  noticeExecution: {
    undetermined: "未判定",
    not_required: "対応不要と判定",
    completed: "要対応で反映済み",
    pending: "要対応で未対応",
  },
  laborLawyerShare: {
    undetermined: "未判定",
    not_required: "対応不要と判定",
    completed: "要対応で反映済み",
    pending: "要対応で未対応",
  },
  salaryListReflection: {
    undetermined: "未判定",
    not_required: "対応不要と判定",
    completed: "要対応で反映済み",
    pending: "要対応で未対応",
  },
};

/** 列の表示名 */
export const STEP_LABELS: Record<keyof WorkflowSteps, { label: string; shortLabel: string }> = {
  smartHRReflection: { label: "SmartHR更新", shortLabel: "SmartHR更新" },
  noticeExecution: { label: "本人通知", shortLabel: "本人通知" },
  laborLawyerShare: { label: "社労士共有", shortLabel: "社労士共有" },
  salaryListReflection: { label: "給与DB反映", shortLabel: "給与DB反映" },
};

/** 給与関連カテゴリかどうか（ワークフローステップ表示判定用） */
export function isSalaryCategory(category: string | null | undefined): boolean {
  return category === "salary";
}

export function nextStepStatus(current: WorkflowStepStatus): WorkflowStepStatus {
  const idx = STEP_CYCLE.indexOf(current);
  return STEP_CYCLE[(idx + 1) % STEP_CYCLE.length] as WorkflowStepStatus;
}
