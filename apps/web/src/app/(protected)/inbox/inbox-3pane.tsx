"use client";

import type { ResponseStatus } from "@hr-system/shared";
import { MessageSquare, Paperclip } from "lucide-react";
import { ChatMessageDetailPane } from "@/components/message-detail-pane";
import { TaskPriorityDot } from "@/components/task-priority-selector";
import { CATEGORY_LABELS, RESPONSE_STATUS_DOT_COLORS } from "@/lib/constants";
import type { ChatMessageDetail, ChatMessageSummary } from "@/lib/types";
import { cn, formatDateTimeJST } from "@/lib/utils";
import {
  updateResponseStatusAction,
  updateTaskPriorityAction,
  updateWorkflowAction,
} from "./actions";
import { HandoverForm } from "./handover-form";
import { useSelectMessage } from "./use-select-message";

interface Inbox3PaneProps {
  messages: ChatMessageSummary[];
  selectedMessage: ChatMessageDetail | null;
  selectedId: string | null;
}

export function Inbox3Pane({ messages, selectedMessage, selectedId }: Inbox3PaneProps) {
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
          const intent = msg.intent;
          const responseStatus = (intent?.responseStatus ?? "unresponded") as ResponseStatus;
          const category = intent?.category ?? "other";
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
                {/* ステータスドット */}
                <span
                  className={cn(
                    "h-2 w-2 flex-shrink-0 rounded-full",
                    RESPONSE_STATUS_DOT_COLORS[responseStatus],
                  )}
                />
                <span className="truncate text-xs font-medium">{msg.senderName}</span>
                {msg.spaceDisplayName && (
                  <span className="truncate text-xs text-muted-foreground">
                    @ {msg.spaceDisplayName}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDateTimeJST(msg.createdAt)}
                </span>
              </div>

              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{msg.content}</p>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {CATEGORY_LABELS[category] ?? category}
                </span>
                {intent?.confidenceScore != null && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {(intent.confidenceScore * 100).toFixed(0)}%
                  </span>
                )}
                {msg.attachments.length > 0 && (
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                )}
                {intent?.taskPriority && <TaskPriorityDot priority={intent.taskPriority} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* 中央+右ペイン: 詳細 */}
      {selectedMessage ? (
        <ChatMessageDetailPane
          message={selectedMessage}
          onClose={() => selectMessage(null)}
          onUpdateResponseStatus={updateResponseStatusAction}
          onUpdateTaskPriority={updateTaskPriorityAction}
          onUpdateWorkflow={updateWorkflowAction}
          extraContent={
            selectedMessage.intent && (
              <div className="mt-4">
                <HandoverForm
                  chatMessageId={selectedMessage.id}
                  taskSummary={selectedMessage.intent.taskSummary ?? null}
                  assignees={selectedMessage.intent.assignees ?? null}
                  notes={selectedMessage.intent.notes ?? null}
                />
              </div>
            )
          }
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
