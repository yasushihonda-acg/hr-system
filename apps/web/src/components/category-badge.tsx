import { CATEGORY_CONFIG } from "@/lib/constants";

interface CategoryBadgeProps {
  /** 単一カテゴリ（後方互換） */
  category?: string | null | undefined;
  /** 複数カテゴリ */
  categories?: string[];
}

function SingleBadge({ category }: { category: string }) {
  // biome-ignore lint/style/noNonNullAssertion: CATEGORY_CONFIG.other is always defined
  const cfg = (CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.other)!;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cfg.pill}`}
    >
      {cfg.label}
    </span>
  );
}

export function CategoryBadge({ category, categories }: CategoryBadgeProps) {
  // categories 優先
  const cats = categories ?? (category ? [category] : []);

  if (cats.length === 0) {
    return <span className="text-xs text-muted-foreground">未分類</span>;
  }

  return (
    <span className="inline-flex flex-wrap gap-1">
      {cats.map((c) => (
        <SingleBadge key={c} category={c} />
      ))}
    </span>
  );
}
