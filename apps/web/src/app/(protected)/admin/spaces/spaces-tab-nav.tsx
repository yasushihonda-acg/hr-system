"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "chat", label: "Google Chat" },
  { key: "line", label: "LINE" },
] as const;

export function SpacesTabNav({ activeTab }: { activeTab: string }) {
  return (
    <div className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/admin/spaces?tab=${tab.key}`}
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
