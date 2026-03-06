"use client";

import { Check, Circle, Minus } from "lucide-react";
import { useState } from "react";
import type { WorkflowStepStatus, WorkflowSteps } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEP_LABELS: { key: keyof WorkflowSteps; label: string; shortLabel: string }[] = [
  { key: "salaryListReflection", label: "職員給与一覧SSへの反映", shortLabel: "給与SS" },
  { key: "noticeExecution", label: "通知・締結", shortLabel: "通知" },
  { key: "laborLawyerShare", label: "社労士共有", shortLabel: "社労士" },
  { key: "smartHRReflection", label: "SmartHRへの反映", shortLabel: "SmartHR" },
];

const STATUS_CYCLE: WorkflowStepStatus[] = ["undetermined", "completed", "not_required"];

const STATUS_CONFIG: Record<
  WorkflowStepStatus,
  { icon: typeof Check; color: string; label: string }
> = {
  undetermined: { icon: Circle, color: "text-muted-foreground", label: "未定" },
  completed: { icon: Check, color: "text-[var(--status-ok)]", label: "完了" },
  not_required: { icon: Minus, color: "text-muted-foreground/60", label: "不要" },
};

interface WorkflowPanelProps {
  steps: WorkflowSteps | null;
  onUpdate: (steps: WorkflowSteps) => Promise<void>;
  compact?: boolean;
}

export function WorkflowPanel({ steps, onUpdate, compact = false }: WorkflowPanelProps) {
  const current: WorkflowSteps = steps ?? {
    salaryListReflection: "undetermined",
    noticeExecution: "undetermined",
    laborLawyerShare: "undetermined",
    smartHRReflection: "undetermined",
  };

  const [localSteps, setLocalSteps] = useState<WorkflowSteps>(current);
  const [saving, setSaving] = useState(false);

  const completedCount = STEP_LABELS.filter((s) => localSteps[s.key] === "completed").length;

  async function handleToggle(key: keyof WorkflowSteps) {
    const currentStatus = localSteps[key];
    const nextIdx = (STATUS_CYCLE.indexOf(currentStatus) + 1) % STATUS_CYCLE.length;
    const nextStatus = STATUS_CYCLE[nextIdx];

    const updated = { ...localSteps, [key]: nextStatus };
    setLocalSteps(updated);
    setSaving(true);
    try {
      await onUpdate(updated);
    } finally {
      setSaving(false);
    }
  }

  if (compact) {
    return <WorkflowProgressBar steps={localSteps} />;
  }

  return (
    <div className="space-y-3">
      <WorkflowProgressBar steps={localSteps} />
      <div className="space-y-1">
        {STEP_LABELS.map((step) => {
          const status = localSteps[step.key];
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;

          return (
            <button
              key={step.key}
              type="button"
              disabled={saving}
              onClick={() => handleToggle(step.key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                saving && "opacity-50 pointer-events-none",
              )}
            >
              <Icon className={cn("h-4 w-4 flex-shrink-0", config.color)} />
              <span
                className={cn(
                  "flex-1",
                  status === "completed" && "line-through text-muted-foreground",
                  status === "not_required" && "text-muted-foreground/60",
                )}
              >
                {step.label}
              </span>
              <span className={cn("text-[10px]", config.color)}>{config.label}</span>
            </button>
          );
        })}
      </div>
      {saving && <p className="text-[10px] text-muted-foreground">保存中...</p>}
    </div>
  );
}

export function WorkflowProgressBar({ steps }: { steps: WorkflowSteps | null }) {
  const current: WorkflowSteps = steps ?? {
    salaryListReflection: "undetermined",
    noticeExecution: "undetermined",
    laborLawyerShare: "undetermined",
    smartHRReflection: "undetermined",
  };

  const completedCount = STEP_LABELS.filter((s) => current[s.key] === "completed").length;

  return (
    <div className="flex items-center gap-1.5">
      {STEP_LABELS.map((step) => {
        const status = current[step.key];
        return (
          <div
            key={step.key}
            title={`${step.label}: ${STATUS_CONFIG[status].label}`}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              status === "completed" && "bg-[var(--status-ok)]",
              status === "not_required" && "bg-muted-foreground/20",
              status === "undetermined" && "bg-muted-foreground/10",
            )}
          />
        );
      })}
      <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">
        {completedCount}/{STEP_LABELS.length}
      </span>
    </div>
  );
}
