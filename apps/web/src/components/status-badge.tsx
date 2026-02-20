import type { DraftStatus } from "@hr-system/shared";
import { cn } from "@/lib/utils";

const config: Record<DraftStatus, { label: string; className: string; dot: string }> = {
  draft: { label: "ドラフト", className: "badge-draft", dot: "bg-slate-400" },
  reviewed: { label: "レビュー済", className: "badge-reviewed", dot: "bg-blue-500" },
  pending_ceo_approval: {
    label: "社長承認待ち",
    className: "badge-pending",
    dot: "bg-amber-500 animate-pulse",
  },
  approved: { label: "承認済", className: "badge-approved", dot: "bg-green-500" },
  rejected: { label: "却下", className: "badge-rejected", dot: "bg-red-500" },
  processing: { label: "処理中", className: "badge-processing", dot: "bg-sky-500 animate-pulse" },
  completed: { label: "完了", className: "badge-completed", dot: "bg-emerald-500" },
  failed: { label: "失敗", className: "badge-failed", dot: "bg-rose-500" },
};

export function StatusBadge({ status }: { status: DraftStatus }) {
  const { label, className, dot } = config[status] ?? {
    label: status,
    className: "badge-draft",
    dot: "bg-gray-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dot)} />
      {label}
    </span>
  );
}
