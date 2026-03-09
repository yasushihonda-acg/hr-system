"use client";

import { Image as ImageIcon, MessageSquare } from "lucide-react";
import { LineMessageDetailPane } from "@/components/line-message-detail-pane";
import { TaskPriorityDot } from "@/components/task-priority-selector";
import { RESPONSE_STATUS_DOT_COLORS } from "@/lib/constants";
import type { LineMessageDetail, LineMessageSummary } from "@/lib/types";
import { cn, formatDateTimeJST } from "@/lib/utils";
import { updateLineResponseStatusAction, updateLineTaskPriorityAction } from "./actions";
import { useSelectMessage } from "./use-select-message";

interface LineInbox3PaneProps {
  messages: LineMessageSummary[];
  selectedMessage: LineMessageDetail | null;
  selectedId: string | null;
}

export function LineInbox3Pane({ messages, selectedMessage, selectedId }: LineInbox3PaneProps) {
  const selectMessage = useSelectMessage();

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">該当するメッセージはありません</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 左ペイン: メッセージ一覧 */}
      <div
        className={cn(
          "flex-shrink-0 overflow-y-auto border-r border-border/60 bg-white",
          "w-full md:w-[320px]",
          selectedId && "hidden md:block",
        )}
      >
        {messages.map((msg) => {
          const responseStatus = msg.responseStatus;
          const isSelected = msg.id === selectedId;

          return (
            <button
              key={msg.id}
              type="button"
              onClick={() => selectMessage(msg.id)}
              className={cn(
                "w-full border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                isSelected && "bg-accent",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 flex-shrink-0 rounded-full",
                    RESPONSE_STATUS_DOT_COLORS[responseStatus],
                  )}
                />
                <span className="truncate text-xs font-medium">{msg.senderName}</span>
                {msg.groupName && (
                  <span className="truncate text-xs text-muted-foreground">@ {msg.groupName}</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDateTimeJST(msg.createdAt)}
                </span>
              </div>

              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {msg.lineMessageType === "image" ? (
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon size={12} />
                    画像
                  </span>
                ) : (
                  msg.content
                )}
              </p>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">
                  LINE
                </span>
                {msg.lineMessageType !== "text" && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {msg.lineMessageType}
                  </span>
                )}
                {msg.taskPriority && <TaskPriorityDot priority={msg.taskPriority} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* 中央ペイン: 詳細 */}
      {selectedMessage ? (
        <LineMessageDetailPane
          message={selectedMessage}
          onClose={() => selectMessage(null)}
          onUpdateResponseStatus={updateLineResponseStatusAction}
          onUpdateTaskPriority={updateLineTaskPriorityAction}
        />
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">メッセージを選択してください</p>
          </div>
        </div>
      )}
    </div>
  );
}
