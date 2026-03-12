"use client";

import { useRouter } from "next/navigation";

interface FilterOption {
  value: string;
  label: string;
}

/** フィルター変更時のURL構築（テスト用にexport） */
export function buildFilterUrl(
  searchParams: Record<string, string>,
  paramKey: string,
  value: string,
): string {
  const sp = new URLSearchParams();
  const merged = { ...searchParams, [paramKey]: value, page: "1" };
  for (const [k, v] of Object.entries(merged)) {
    if (v && v !== "all" && !(k === "page" && v === "1")) {
      sp.set(k, v);
    }
  }
  const qs = sp.toString();
  return `/task-board${qs ? `?${qs}` : ""}`;
}

export function FilterSelect({
  options,
  currentValue,
  paramKey,
  searchParams,
  className,
}: {
  options: FilterOption[];
  currentValue: string;
  paramKey: string;
  searchParams: Record<string, string>;
  className?: string;
}) {
  const router = useRouter();

  return (
    <select
      value={currentValue}
      onChange={(e) => router.push(buildFilterUrl(searchParams, paramKey, e.target.value))}
      className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 ${className ?? ""}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
