"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "regex", label: "正規表現ルール" },
  { key: "llm", label: "LLMルール" },
  { key: "test", label: "テスト" },
  { key: "accuracy", label: "分類精度" },
] as const;

export function TabNav({ activeTab }: { activeTab: string }) {
  return (
    <div className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/ai-settings?tab=${tab.key}`}
          className={cn(
            "px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors",
            activeTab === tab.key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
