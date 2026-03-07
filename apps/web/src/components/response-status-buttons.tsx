"use client";

import type { ResponseStatus } from "@hr-system/shared";
import { RESPONSE_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ResponseStatusButtonsProps {
  currentStatus: ResponseStatus;
  onChangeStatus: (status: ResponseStatus) => void;
  disabled?: boolean;
}

export function ResponseStatusButtons({
  currentStatus,
  onChangeStatus,
  disabled,
}: ResponseStatusButtonsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(["unresponded", "in_progress", "responded", "not_required"] as ResponseStatus[]).map(
        (s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onChangeStatus(s)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              s === currentStatus
                ? "border-current bg-current/10 ring-2 ring-current/20"
                : "border-border text-muted-foreground opacity-60 hover:opacity-100",
              s === "unresponded" && "text-red-600",
              s === "in_progress" && "text-yellow-600",
              s === "responded" && "text-green-600",
              s === "not_required" && "text-gray-500",
              disabled && "pointer-events-none opacity-40",
            )}
          >
            {RESPONSE_STATUS_LABELS[s]}
          </button>
        ),
      )}
    </div>
  );
}
