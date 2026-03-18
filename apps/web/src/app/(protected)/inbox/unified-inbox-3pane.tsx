"use client";

import type { ResponseStatus } from "@hr-system/shared";
import { Image as ImageIcon, MessageSquare, Paperclip } from "lucide-react";
import { CategoryBadge } from "@/components/category-badge";
import { LineMessageDetailPane } from "@/components/line-message-detail-pane";
import { ChatMessageDetailPane } from "@/components/message-detail-pane";
import { NotesField } from "@/components/notes-field";
import { TaskPriorityDot } from "@/components/task-priority-selector";
import { RESPONSE_STATUS_DOT_COLORS } from "@/lib/constants";
import type { UnifiedMessageDetail, UnifiedMessageSummary } from "@/lib/types";
import { cn, formatDateTimeJST } from "@/lib/utils";
import {
  updateChatAssigneesAction,
  updateChatCategoriesAction,
  updateChatDeadlineAction,
  updateChatNotesAction,
  updateLineAssigneesAction,
  updateLineCategoriesAction,
  updateLineDeadlineAction,
  updateLineNotesAction,
  updateLineResponseStatusAction,
  updateLineTaskPriorityAction,
  updateResponseStatusAction,
  updateTaskPriorityAction,
  updateWorkflowAction,
} from "./actions";
import { useSelectMessage } from "./use-select-message";

interface UnifiedInbox3PaneProps {
  messages: UnifiedMessageSummary[];
  selectedMessage: UnifiedMessageDetail | null;
  selectedId: string | null;
}

function GchatRow({ msg }: { msg: UnifiedMessageSummary & { source: "gchat" } }) {
  const intent = msg.intent;
  const responseStatus = (intent?.responseStatus ?? "unresponded") as ResponseStatus;
  const categories = intent?.categories ?? ["other"];

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 flex-shrink-0 rounded-full",
            RESPONSE_STATUS_DOT_COLORS[responseStatus],
          )}
        />
        <span className="truncate text-xs font-medium">{msg.senderName}</span>
        {msg.spaceDisplayName && (
          <span className="truncate text-xs text-muted-foreground">@ {msg.spaceDisplayName}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatDateTimeJST(msg.createdAt)}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{msg.content}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">Chat</span>
        <CategoryBadge categories={categories} />
        {intent?.confidenceScore != null && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {(intent.confidenceScore * 100).toFixed(0)}%
          </span>
        )}
        {msg.attachments.length > 0 && <Paperclip className="h-3 w-3 text-muted-foreground" />}
        {intent?.taskPriority && <TaskPriorityDot priority={intent.taskPriority} />}
      </div>
    </>
  );
}

function LineRow({ msg }: { msg: UnifiedMessageSummary & { source: "line" } }) {
  const responseStatus = msg.responseStatus;

  return (
    <>
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
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">LINE</span>
        <CategoryBadge categories={msg.categories} />
        {msg.lineMessageType !== "text" && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {msg.lineMessageType}
          </span>
        )}
        {msg.taskPriority && <TaskPriorityDot priority={msg.taskPriority} />}
      </div>
    </>
  );
}

function DetailPane({ message, onClose }: { message: UnifiedMessageDetail; onClose: () => void }) {
  if (message.source === "gchat") {
    return (
      <ChatMessageDetailPane
        message={message}
        onClose={onClose}
        onUpdateResponseStatus={updateResponseStatusAction}
        onUpdateTaskPriority={updateTaskPriorityAction}
        onUpdateWorkflow={updateWorkflowAction}
        assignees={message.intent?.assignees ?? null}
        deadline={message.intent?.deadline ?? null}
        onUpdateAssignees={updateChatAssigneesAction}
        onUpdateDeadline={updateChatDeadlineAction}
        onUpdateCategories={updateChatCategoriesAction}
        extraContent={
          <div className="mt-4">
            <NotesField
              value={message.intent?.notes ?? null}
              onSave={(notes) => updateChatNotesAction(message.id, notes)}
            />
          </div>
        }
      />
    );
  }

  return (
    <LineMessageDetailPane
      message={message}
      onClose={onClose}
      onUpdateResponseStatus={updateLineResponseStatusAction}
      onUpdateTaskPriority={updateLineTaskPriorityAction}
      onUpdateAssignees={updateLineAssigneesAction}
      onUpdateDeadline={updateLineDeadlineAction}
      onUpdateCategories={updateLineCategoriesAction}
      onUpdateNotes={updateLineNotesAction}
    />
  );
}

export function UnifiedInbox3Pane({
  messages,
  selectedMessage,
  selectedId,
}: UnifiedInbox3PaneProps) {
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
          const isSelected = msg.id === selectedId;
          return (
            <button
              key={`${msg.source}-${msg.id}`}
              type="button"
              onClick={() => selectMessage(msg.id)}
              className={cn(
                "w-full border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                isSelected && "bg-accent",
              )}
            >
              {msg.source === "gchat" ? <GchatRow msg={msg} /> : <LineRow msg={msg} />}
            </button>
          );
        })}
      </div>

      {/* 中央+右ペイン: 詳細 */}
      {selectedMessage ? (
        <div className="flex-1 overflow-y-auto">
          <DetailPane message={selectedMessage} onClose={() => selectMessage(null)} />
        </div>
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
