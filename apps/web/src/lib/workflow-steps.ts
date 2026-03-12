import type { WorkflowStepStatus, WorkflowSteps } from "@/lib/types";

export const STEP_CYCLE: WorkflowStepStatus[] = [
  "undetermined",
  "completed",
  "not_required",
  "pending",
];

export const DEFAULT_STEPS: WorkflowSteps = {
  salaryListReflection: "undetermined",
  smartHRReflection: "undetermined",
  noticeExecution: "undetermined",
  laborLawyerShare: "undetermined",
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

/** 表示順序（スプレッドシート準拠）: ❶SS反映 → ❷SmartHR → ❸通知・締結 → ❹社労士共有 */
export const STEP_KEYS = [
  "salaryListReflection",
  "smartHRReflection",
  "noticeExecution",
  "laborLawyerShare",
] as const;

/** 列ごとのステータスラベル（スプレッドシート準拠） */
export const STEP_STATUS_LABELS: Record<keyof WorkflowSteps, Record<WorkflowStepStatus, string>> = {
  salaryListReflection: {
    undetermined: "未判定",
    not_required: "対応不要と判定",
    completed: "要対応で反映済み",
    pending: "要対応で未対応",
  },
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
    pending: "要対応で未反映",
  },
  laborLawyerShare: {
    undetermined: "未判定",
    not_required: "対応不要と判定",
    completed: "要対応で反映済み",
    pending: "要対応で未反映",
  },
};

/** 列の表示名 */
export const STEP_LABELS: Record<keyof WorkflowSteps, { label: string; shortLabel: string }> = {
  salaryListReflection: { label: "職員給与一覧SSへの反映", shortLabel: "SS反映" },
  smartHRReflection: { label: "SmartHRへの反映", shortLabel: "SmartHR" },
  noticeExecution: { label: "通知・締結", shortLabel: "通知" },
  laborLawyerShare: { label: "社労士共有", shortLabel: "社労士" },
};

export function nextStepStatus(current: WorkflowStepStatus): WorkflowStepStatus {
  const idx = STEP_CYCLE.indexOf(current);
  return STEP_CYCLE[(idx + 1) % STEP_CYCLE.length] as WorkflowStepStatus;
}
