"use client";

import { MessageSquare } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import type { LineMessageSummary } from "@/lib/types";
import { LineMessageCard } from "./line-message-card";

export function LineViewContainer({ messages }: { messages: LineMessageSummary[] }) {
  return (
    <div className="space-y-3">
      <AutoRefresh />
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
          <MessageSquare className="mb-3 text-muted-foreground/40" size={36} />
          <p className="text-sm font-medium text-muted-foreground">LINE メッセージがありません</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Botをグループに招待してメッセージを送信してください
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <LineMessageCard key={msg.id} msg={msg} />
          ))}
        </div>
      )}
    </div>
  );
}
