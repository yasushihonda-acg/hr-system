"use client";

import { useState, useTransition } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { CATEGORY_CONFIG } from "@/lib/constants";

interface CategoriesFieldProps {
  categories: string[];
  onSave: (categories: string[]) => Promise<void>;
}

const ALL_CATEGORIES = Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  pill: cfg.pill,
}));

export function CategoriesField({ categories, onSave }: CategoriesFieldProps) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(categories);
  const [isPending, startTransition] = useTransition();

  function toggleCategory(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  }

  function handleCancel() {
    setSelected(categories);
    setEditing(false);
  }

  function handleSave() {
    if (selected.length === 0) return;
    startTransition(async () => {
      await onSave(selected);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <CategoryBadge categories={categories} />
        <button
          type="button"
          onClick={() => {
            setSelected(categories);
            setEditing(true);
          }}
          className="text-muted-foreground hover:text-foreground"
          title="カテゴリを編集"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ALL_CATEGORIES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleCategory(opt.value)}
            disabled={isPending}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              selected.includes(opt.value)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {selected.length === 0 && (
        <p className="text-xs text-destructive">最低1つのカテゴリを選択してください</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || selected.length === 0}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-md bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
