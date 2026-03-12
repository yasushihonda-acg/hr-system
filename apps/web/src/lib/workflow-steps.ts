import type { WorkflowStepStatus, WorkflowSteps } from "@/lib/types";

export const STEP_CYCLE: WorkflowStepStatus[] = ["undetermined", "completed", "not_required"];

export const DEFAULT_STEPS: WorkflowSteps = {
  salaryListReflection: "undetermined",
  noticeExecution: "undetermined",
  laborLawyerShare: "undetermined",
  smartHRReflection: "undetermined",
};

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
};

export const STEP_KEYS = [
  "salaryListReflection",
  "noticeExecution",
  "laborLawyerShare",
  "smartHRReflection",
] as const;

export function nextStepStatus(current: WorkflowStepStatus): WorkflowStepStatus {
  const idx = STEP_CYCLE.indexOf(current);
  return STEP_CYCLE[(idx + 1) % STEP_CYCLE.length] as WorkflowStepStatus;
}
