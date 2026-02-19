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
  currentCategory,
}: {
  chatMessageId: string;
  currentCategory: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(currentCategory);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/chat-messages/${chatMessageId}/intent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, comment: comment || undefined }),
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
            onClick={() => setCategory(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="コメント（任意、最大500文字）"
        maxLength={500}
        rows={2}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={loading || category === currentCategory}>
          {loading ? "保存中..." : "再分類を保存"}
        </Button>
        {success && <span className="text-sm text-green-600">保存しました</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}
