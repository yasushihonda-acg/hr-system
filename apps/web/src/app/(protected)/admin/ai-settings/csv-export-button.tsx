"use client";

import { Download } from "lucide-react";
import { useCallback } from "react";
import type { OverridePattern } from "@/lib/types";

export function CsvExportButton({ patterns }: { patterns: OverridePattern[] }) {
  const handleExport = useCallback(() => {
    if (patterns.length === 0) return;

    const BOM = "\uFEFF";
    const headers = [
      "修正前カテゴリ",
      "修正後カテゴリ",
      "件数",
      "割合(%)",
      "サンプルメッセージ1",
      "サンプルメッセージ2",
      "サンプルメッセージ3",
      "提案キーワード",
    ];

    const rows = patterns.map((p) => [
      p.fromCategory,
      p.toCategory,
      String(p.count),
      String(p.percentage),
      p.sampleMessages[0]?.content ?? "",
      p.sampleMessages[1]?.content ?? "",
      p.sampleMessages[2]?.content ?? "",
      p.suggestedKeywords.join(", "),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `override-patterns-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [patterns]);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={patterns.length === 0}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
    >
      <Download className="h-4 w-4" />
      CSV Export
    </button>
  );
}
