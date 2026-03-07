"use client";

import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { StatusBadge } from "@/components/status-badge";
import { TransitionButtons } from "@/components/transition-buttons";
import type { DraftDetail } from "@/lib/types";

function formatCurrency(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP");
}

interface DraftSidePanelProps {
  draft: DraftDetail;
}

export function DraftSidePanel({ draft }: DraftSidePanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const close = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("id");
    const qs = sp.toString();
    router.replace(`/tasks${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router, searchParams]);

  const diff = draft.afterTotal - draft.beforeTotal;
  const diffSign = diff > 0 ? "+" : "";

  return (
    <div className="flex h-full flex-col border-l border-border/60 bg-white">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold">ドラフト詳細</h2>
          <StatusBadge status={draft.status} />
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/drafts/${draft.id}`}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
            title="全画面で開く"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 承認操作 */}
        <TransitionButtons draftId={draft.id} nextActions={draft.nextActions} />

        {/* 基本情報 */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">基本情報</h3>
          <div className="rounded-lg border border-border/60 p-3 space-y-1.5 text-xs">
            <Row label="変更種別" value={draft.changeType === "mechanical" ? "機械的" : "裁量的"} />
            <Row label="理由" value={draft.reason ?? "—"} />
            <Row label="適用日" value={formatDate(draft.effectiveDate)} />
            <Row label="作成日" value={formatDateTime(draft.createdAt)} />
            {draft.reviewedBy && <Row label="レビュー者" value={draft.reviewedBy} />}
            {draft.approvedBy && <Row label="承認者" value={draft.approvedBy} />}
          </div>
        </section>

        {/* 金額比較 */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">給与変更</h3>
          <div className="rounded-lg border border-border/60 p-3 space-y-1.5 text-xs">
            <Row label="変更前(基本給)" value={formatCurrency(draft.beforeBaseSalary)} />
            <Row label="変更後(基本給)" value={formatCurrency(draft.afterBaseSalary)} />
            <div className="border-t border-border/40 pt-1.5" />
            <Row label="変更前(総額)" value={formatCurrency(draft.beforeTotal)} />
            <Row label="変更後(総額)" value={formatCurrency(draft.afterTotal)} bold />
            <Row
              label="差額"
              value={`${diffSign}${formatCurrency(diff)}`}
              color={diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : undefined}
            />
          </div>
        </section>

        {/* AI 分析 */}
        {(draft.aiConfidence !== null || draft.aiReasoning) && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground">AI 分析</h3>
            <div className="rounded-lg border border-border/60 p-3 space-y-1.5 text-xs">
              {draft.aiConfidence !== null && (
                <Row label="信頼度" value={`${(draft.aiConfidence * 100).toFixed(0)}%`} />
              )}
              {draft.aiReasoning && <Row label="推論" value={draft.aiReasoning} />}
            </div>
          </section>
        )}

        {/* 承認履歴 */}
        {draft.approvalLogs.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground">
              承認履歴 ({draft.approvalLogs.length}件)
            </h3>
            <div className="space-y-1.5">
              {draft.approvalLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-border/60 p-2.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={log.fromStatus} />
                    <span className="text-muted-foreground">→</span>
                    <StatusBadge status={log.toStatus} />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                    <span>{log.actorEmail}</span>
                    <span>{formatDateTime(log.createdAt)}</span>
                  </div>
                  {log.comment && <p className="mt-1">{log.comment}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-bold" : ""} ${color ?? ""}`}>{value}</span>
    </div>
  );
}
