import { CATEGORY_CONFIG } from "@/lib/constants";

interface CategoryBadgeProps {
  category: string | null | undefined;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const cfg = category ? (CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.other) : null;

  if (!cfg) {
    return <span className="text-xs text-muted-foreground">未分類</span>;
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cfg.pill}`}
    >
      {cfg.label}
    </span>
  );
}
