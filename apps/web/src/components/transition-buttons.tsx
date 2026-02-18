"use client";

import type { DraftStatus } from "@hr-system/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Partial<
  Record<DraftStatus, { label: string; variant: "default" | "destructive" | "outline" }>
> = {
  reviewed: { label: "レビュー完了", variant: "default" },
  pending_ceo_approval: { label: "社長承認へ", variant: "default" },
  approved: { label: "承認", variant: "default" },
  rejected: { label: "却下", variant: "destructive" },
  draft: { label: "差し戻し", variant: "outline" },
  processing: { label: "処理開始", variant: "default" },
};

export function TransitionButtons({
  draftId,
  nextActions,
}: {
  draftId: string;
  nextActions: DraftStatus[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (nextActions.length === 0) return null;

  async function handleTransition(toStatus: DraftStatus) {
    setLoading(toStatus);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draftId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "操作に失敗しました");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作に失敗しました");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {nextActions.map((toStatus) => {
          const config = STATUS_LABELS[toStatus] ?? {
            label: toStatus,
            variant: "outline" as const,
          };
          return (
            <Button
              key={toStatus}
              variant={config.variant}
              disabled={loading !== null}
              onClick={() => handleTransition(toStatus)}
            >
              {loading === toStatus ? "処理中..." : config.label}
            </Button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
