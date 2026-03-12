"use client";

import { useRouter } from "next/navigation";

interface FilterOption {
  value: string;
  label: string;
}

export function FilterSelect({
  options,
  currentValue,
  buildUrl,
  className,
}: {
  options: FilterOption[];
  currentValue: string;
  buildUrl: (value: string) => string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <select
      value={currentValue}
      onChange={(e) => router.push(buildUrl(e.target.value))}
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
