"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const CATEGORY_OPTIONS = [
  { value: "salary", label: "給与・社保" },
  { value: "retirement", label: "退職・休職" },
  { value: "hiring", label: "入社・採用" },
  { value: "contract", label: "契約変更" },
  { value: "transfer", label: "施設・異動" },
  { value: "foreigner", label: "外国人・ビザ" },
  { value: "training", label: "研修・監査" },
  { value: "health_check", label: "健康診断" },
  { value: "attendance", label: "勤怠・休暇" },
  { value: "other", label: "その他" },
] as const;

export function ReclassifyForm({
  chatMessageId,
  currentCategories,
}: {
  chatMessageId: string;
  currentCategories: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(currentCategories);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function toggleCategory(value: string) {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  }

  const hasChanged =
    selected.length !== currentCategories.length ||
    selected.some((c) => !currentCategories.includes(c));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/chat-messages/${chatMessageId}/intent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: selected, comment: comment || undefined }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "再分類に失敗しました");
      }
      setSuccess(true);
      setComment("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "再分類に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleCategory(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
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

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="コメント（任意、最大500文字）"
        maxLength={500}
        rows={2}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={loading || !hasChanged || selected.length === 0}>
          {loading ? "保存中..." : "再分類を保存"}
        </Button>
        {success && <span className="text-sm text-green-600">保存しました</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}
