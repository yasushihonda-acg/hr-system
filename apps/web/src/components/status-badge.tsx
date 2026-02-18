import type { DraftStatus } from "@hr-system/shared";
import { Badge } from "@/components/ui/badge";

const config: Record<
  DraftStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "ドラフト", variant: "outline" },
  reviewed: { label: "レビュー済", variant: "secondary" },
  pending_ceo_approval: { label: "社長承認待ち", variant: "secondary" },
  approved: { label: "承認済", variant: "default" },
  rejected: { label: "却下", variant: "destructive" },
  processing: { label: "処理中", variant: "secondary" },
  completed: { label: "完了", variant: "default" },
  failed: { label: "失敗", variant: "destructive" },
};

export function StatusBadge({ status }: { status: DraftStatus }) {
  const { label, variant } = config[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={variant}>{label}</Badge>;
}
