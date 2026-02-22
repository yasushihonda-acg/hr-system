"use client";

import type { ConfusionMatrixEntry } from "@/lib/types";

const CATEGORY_SHORT_LABELS: Record<string, string> = {
  salary: "給与",
  retirement: "退職",
  hiring: "入社",
  contract: "契約",
  transfer: "異動",
  foreigner: "外国人",
  training: "研修",
  health_check: "健診",
  attendance: "勤怠",
  other: "その他",
};

export function ConfusionMatrixTable({
  entries,
  categories,
}: {
  entries: ConfusionMatrixEntry[];
  categories: string[];
}) {
  // Build matrix lookup
  const matrix: Record<string, Record<string, number>> = {};
  let maxCount = 0;
  for (const e of entries) {
    if (!matrix[e.from]) matrix[e.from] = {};
    matrix[e.from]![e.to] = e.count;
    if (e.count > maxCount) maxCount = e.count;
  }

  // Only show categories that appear in the data
  const activeCategories = categories.filter((cat) =>
    entries.some((e) => e.from === cat || e.to === cat),
  );

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">手動修正データがありません</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
              修正前 \ 修正後
            </th>
            {activeCategories.map((cat) => (
              <th key={cat} className="px-2 py-1.5 text-center font-medium text-muted-foreground">
                {CATEGORY_SHORT_LABELS[cat] ?? cat}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeCategories.map((fromCat) => (
            <tr key={fromCat} className="border-t">
              <td className="px-2 py-1.5 font-medium">
                {CATEGORY_SHORT_LABELS[fromCat] ?? fromCat}
              </td>
              {activeCategories.map((toCat) => {
                const count = matrix[fromCat]?.[toCat] ?? 0;
                const opacity = maxCount > 0 ? count / maxCount : 0;
                return (
                  <td
                    key={toCat}
                    className="px-2 py-1.5 text-center tabular-nums"
                    style={{
                      backgroundColor:
                        count > 0 ? `rgba(239, 68, 68, ${0.1 + opacity * 0.6})` : undefined,
                    }}
                  >
                    {count > 0 ? count : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
