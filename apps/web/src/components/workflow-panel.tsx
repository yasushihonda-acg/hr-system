"use client";

import { AlertCircle, Check, Circle, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import type { WorkflowStepStatus, WorkflowSteps } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DEFAULT_STEPS,
  nextStepStatus,
  STEP_KEYS,
  STEP_LABELS,
  STEP_STATUS_LABELS,
} from "@/lib/workflow-steps";

const STATUS_CONFIG: Record<WorkflowStepStatus, { icon: typeof Check; color: string }> = {
  undetermined: { icon: Circle, color: "text-muted-foreground" },
  completed: { icon: Check, color: "text-[var(--status-ok)]" },
  not_required: { icon: Minus, color: "text-muted-foreground/60" },
  pending: { icon: AlertCircle, color: "text-red-600" },
};

interface WorkflowPanelProps {
  steps: WorkflowSteps | null;
  onUpdate: (steps: WorkflowSteps) => Promise<void>;
  compact?: boolean;
}

export function WorkflowPanel({ steps, onUpdate, compact = false }: WorkflowPanelProps) {
  const [localSteps, setLocalSteps] = useState<WorkflowSteps>(steps ?? { ...DEFAULT_STEPS });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalSteps(steps ?? { ...DEFAULT_STEPS });
  }, [steps]);

  async function handleToggle(key: keyof WorkflowSteps) {
    const next = nextStepStatus(localSteps[key]);
    const updated = { ...localSteps, [key]: next };
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
        {STEP_KEYS.map((key) => {
          const status = localSteps[key];
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          const stepLabel = STEP_LABELS[key].label;
          const statusLabel = STEP_STATUS_LABELS[key][status];

          return (
            <button
              key={key}
              type="button"
              disabled={saving}
              onClick={() => handleToggle(key)}
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
                {stepLabel}
              </span>
              <span className={cn("text-xs", config.color)}>{statusLabel}</span>
            </button>
          );
        })}
      </div>
      {saving && <p className="text-xs text-muted-foreground">保存中...</p>}
    </div>
  );
}

export function WorkflowProgressBar({ steps }: { steps: WorkflowSteps | null }) {
  const current: WorkflowSteps = steps ?? { ...DEFAULT_STEPS };
  const completedCount = STEP_KEYS.filter((key) => current[key] === "completed").length;

  return (
    <div className="flex items-center gap-1.5">
      {STEP_KEYS.map((key) => {
        const status = current[key];
        return (
          <div
            key={key}
            title={`${STEP_LABELS[key].label}: ${STEP_STATUS_LABELS[key][status]}`}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              status === "completed" && "bg-[var(--status-ok)]",
              status === "pending" && "bg-red-400",
              status === "not_required" && "bg-muted-foreground/20",
              status === "undetermined" && "bg-muted-foreground/10",
            )}
          />
        );
      })}
      <span className="ml-1 text-xs tabular-nums text-muted-foreground">
        {completedCount}/{STEP_KEYS.length}
      </span>
    </div>
  );
}
