"use client";

import { LayoutList, MessageSquare, Table2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import type { ChatMessageSummary } from "@/lib/types";
import { MessageCard } from "./message-card";
import { TableView } from "./table-view";

export function ViewContainer({
  messages,
  offset,
  initialView,
}: {
  messages: ChatMessageSummary[];
  offset: number;
  initialView: "card" | "table";
}) {
  const [view, setView] = useState<"card" | "table">(initialView);
  const router = useRouter();
  const searchParams = useSearchParams();

  const switchView = (newView: "card" | "table") => {
    setView(newView); // 即座にクライアント側を切り替え
    // URLを同期（ページ遷移ではなく履歴更新のみ）
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (newView === "card") {
      params.delete("view");
    } else {
      params.set("view", newView);
    }
    const qs = params.toString();
    router.replace(`/chat-messages${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  return (
    <div className="space-y-3">
      <AutoRefresh />
      {/* ビュー切替 */}
      <div className="flex justify-end">
        <div className="flex rounded-lg border border-border/60 bg-card p-0.5">
          <button
            type="button"
            onClick={() => switchView("card")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              view === "card"
                ? "bg-[var(--gradient-from)] text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutList size={13} />
            カード
          </button>
          <button
            type="button"
            onClick={() => switchView("table")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              view === "table"
                ? "bg-[var(--gradient-from)] text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Table2 size={13} />
            テーブル
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
          <MessageSquare className="mb-3 text-muted-foreground/40" size={36} />
          <p className="text-sm font-medium text-muted-foreground">メッセージがありません</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            フィルタ条件を変えてお試しください
          </p>
        </div>
      ) : view === "table" ? (
        <TableView messages={messages} offset={offset} />
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageCard key={msg.id} msg={msg} />
          ))}
        </div>
      )}
    </div>
  );
}
