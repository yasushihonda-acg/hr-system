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

/** テーブルセル用の共通スタイル（列に依存しないアイコン・色） */
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

/** 列ごとのステータスラベル */
export const STEP_STATUS_LABELS: Record<keyof WorkflowSteps, Record<WorkflowStepStatus, string>> = {
  smartHRReflection: {
    undetermined: "未判定",
    not_required: "更新不要と判定",
    completed: "更新済み",
    pending: "要更新で未対応",
  },
  noticeExecution: {
    undetermined: "未判定",
    not_required: "通知不要と判定",
    completed: "通知済み",
    pending: "要通知で未対応",
  },
  laborLawyerShare: {
    undetermined: "未判定",
    not_required: "共有不要と判定",
    completed: "共有済み",
    pending: "要共有で未対応",
  },
  salaryListReflection: {
    undetermined: "未判定",
    not_required: "反映不要と判定",
    completed: "反映済み",
    pending: "要反映で未対応",
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
