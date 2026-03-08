"use client";

import type { InboxCounts } from "@/lib/api";
import { cn } from "@/lib/utils";

export function InboxStatusBar({ counts }: { counts: InboxCounts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const segments: { label: string; count: number; color: string }[] = [
    { label: "未対応", count: counts.unresponded, color: "bg-[var(--status-danger)]" },
    { label: "対応中", count: counts.in_progress, color: "bg-[var(--status-warn)]" },
    { label: "対応済", count: counts.responded, color: "bg-[var(--status-ok)]" },
    { label: "対応不要", count: counts.not_required, color: "bg-muted-foreground/30" },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        対応状況
      </p>
      <div className="flex gap-2">
        {segments.map((seg) => {
          const pct = total > 0 ? (seg.count / total) * 100 : 0;
          return (
            <div key={seg.label} className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">{seg.label}</span>
                <span className="text-xs font-semibold tabular-nums">{seg.count}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-700", seg.color)}
                  style={{ width: `${Math.max(pct, seg.count > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
