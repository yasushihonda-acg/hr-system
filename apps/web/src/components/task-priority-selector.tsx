"use client";

import type { TaskPriority } from "@hr-system/shared";
import { cn } from "@/lib/utils";

const PRIORITY_OPTIONS: Array<{
  value: TaskPriority;
  label: string;
  dotClass: string;
  activeClass: string;
}> = [
  {
    value: "critical",
    label: "極高",
    dotClass: "bg-red-500",
    activeClass: "bg-red-100 text-red-800 border-red-300 ring-1 ring-red-400 font-bold",
  },
  {
    value: "high",
    label: "高",
    dotClass: "bg-orange-400",
    activeClass: "bg-orange-50 text-orange-700 border-orange-300",
  },
  {
    value: "medium",
    label: "中",
    dotClass: "bg-blue-400",
    activeClass: "bg-blue-50 text-blue-700 border-blue-300",
  },
  {
    value: "low",
    label: "低",
    dotClass: "bg-slate-300",
    activeClass: "bg-slate-50 text-slate-600 border-slate-300",
  },
];

interface TaskPrioritySelectorProps {
  value: TaskPriority | null;
  onChange: (priority: TaskPriority | null) => void;
}

export function TaskPrioritySelector({ value, onChange }: TaskPrioritySelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {PRIORITY_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(isActive ? null : opt.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
              isActive
                ? opt.activeClass
                : "border-border/60 text-muted-foreground hover:bg-accent/50",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", opt.dotClass)} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** 左ペイン用の小さな優先度インジケーター */
export function TaskPriorityDot({ priority }: { priority: TaskPriority | null }) {
  if (!priority) return null;

  const opt = PRIORITY_OPTIONS.find((o) => o.value === priority);
  if (!opt) return null;

  if (priority === "critical") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[10px] font-bold text-red-700 animate-pulse">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        {opt.label}
      </span>
    );
  }

  return <span className={cn("h-1.5 w-1.5 rounded-full", opt.dotClass)} title={opt.label} />;
}
