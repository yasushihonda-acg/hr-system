"use client";

import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import { X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { CategoriesField } from "@/components/categories-field";
import { AttachmentList } from "@/components/chat/attachment-list";
import { AssigneesField, DeadlineField } from "@/components/inline-edit-field";
import { PriorityClearDialog } from "@/components/priority-clear-dialog";
import { ResponseStatusButtons } from "@/components/response-status-buttons";
import { TaskPrioritySelector } from "@/components/task-priority-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowPanel } from "@/components/workflow-panel";
import type {
  ChatMessageDetail,
  IntentDetail,
  WorkflowSteps,
  WorkflowUpdateRequest,
} from "@/lib/types";
import { cn, formatDateTimeJST } from "@/lib/utils";

export interface ChatMessageDetailPaneProps {
  message: ChatMessageDetail;
  onClose: () => void;
  onUpdateResponseStatus: (id: string, status: ResponseStatus) => Promise<void>;
  onUpdateTaskPriority: (id: string, priority: TaskPriority | null) => Promise<void>;
  onUpdateWorkflow: (id: string, body: WorkflowUpdateRequest) => Promise<void>;
  /** Optional slot rendered after the workflow section (e.g. NotesField) */
  extraContent?: ReactNode;
  /** Assignees value from intent (for inline editing) */
  assignees?: string | null;
  /** Deadline value from intent (for inline editing) */
  deadline?: string | null;
  /** Save assignees callback */
  onUpdateAssignees?: (id: string, assignees: string | null) => Promise<void>;
  /** Save deadline callback */
  onUpdateDeadline?: (id: string, deadline: string | null) => Promise<void>;
  /** Save categories callback */
  onUpdateCategories?: (id: string, categories: string[]) => Promise<void>;
}

export function ChatMessageDetailPane({
  message,
  onClose,
  onUpdateResponseStatus,
  onUpdateTaskPriority,
  onUpdateWorkflow,
  extraContent,
  assignees,
  deadline,
  onUpdateAssignees,
  onUpdateDeadline,
  onUpdateCategories,
}: ChatMessageDetailPaneProps) {
  const intent = message.intent as IntentDetail | null;
  const responseStatus = (intent?.responseStatus ?? "unresponded") as ResponseStatus;
  const [showClearDialog, setShowClearDialog] = useState(false);

  const handlePriorityChange = (p: TaskPriority | null) => {
    if (p === null) {
      setShowClearDialog(true);
      return;
    }
    onUpdateTaskPriority(message.id, p);
  };

  const handleConfirmClear = () => {
    setShowClearDialog(false);
    onUpdateTaskPriority(message.id, null);
    toast.success("優先度を解除しました");
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 中央ペイン: メッセージ詳細 */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-accent md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-base font-bold">{message.senderName}</h2>
            {message.spaceDisplayName && (
              <span className="text-xs text-muted-foreground">@ {message.spaceDisplayName}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDateTimeJST(message.createdAt)}
            </span>
          </div>
        </div>

        {/* メッセージ / スレッド タブ */}
        <Tabs defaultValue="message">
          {message.threadMessages.length > 0 && (
            <TabsList variant="line" className="mb-4 w-full">
              <TabsTrigger value="message" className="flex-1">
                メッセージ
              </TabsTrigger>
              <TabsTrigger value="thread" className="flex-1">
                スレッド ({message.threadMessages.length})
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="message">
            {/* メッセージ本文 */}
            <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
              {message.content}
            </div>

            {/* 添付ファイル */}
            {message.attachments.length > 0 && (
              <div className="mt-3">
                <AttachmentList attachments={message.attachments} />
              </div>
            )}

            {/* カテゴリ */}
            {intent && onUpdateCategories && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">カテゴリ</p>
                <CategoriesField
                  categories={intent.categories}
                  onSave={(cats) => onUpdateCategories(message.id, cats)}
                />
              </div>
            )}

            {/* 対応ステータス変更 */}
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">対応状況</p>
              <ResponseStatusButtons
                currentStatus={responseStatus}
                onChangeStatus={(s) => onUpdateResponseStatus(message.id, s)}
              />
            </div>

            {/* タスク優先度 */}
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">タスク優先度</p>
              <TaskPrioritySelector
                value={intent?.taskPriority ?? null}
                onChange={handlePriorityChange}
              />
              <PriorityClearDialog
                open={showClearDialog}
                onConfirm={handleConfirmClear}
                onCancel={() => setShowClearDialog(false)}
              />
            </div>

            {/* 担当者・期限 */}
            {onUpdateAssignees && onUpdateDeadline && (
              <div className="mt-4 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <AssigneesField
                  value={assignees ?? null}
                  onSave={(v) => onUpdateAssignees(message.id, v)}
                />
                <DeadlineField
                  value={deadline ?? null}
                  onSave={(v) => onUpdateDeadline(message.id, v)}
                />
              </div>
            )}

            {/* ワークフロー */}
            {intent && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">ワークフロー</p>
                <WorkflowPanelWrapper
                  chatMessageId={message.id}
                  steps={intent.workflowSteps ?? null}
                  onUpdateWorkflow={onUpdateWorkflow}
                />
              </div>
            )}

            {/* Extra content slot (e.g. NotesField) */}
            {extraContent}
          </TabsContent>

          <TabsContent value="thread">
            <ThreadView
              threadMessages={message.threadMessages}
              originalSenderName={message.senderName}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// --- ワークフローラッパー ---

function WorkflowPanelWrapper({
  chatMessageId,
  steps,
  onUpdateWorkflow,
}: {
  chatMessageId: string;
  steps: WorkflowSteps | null;
  onUpdateWorkflow: (id: string, body: WorkflowUpdateRequest) => Promise<void>;
}) {
  async function handleUpdate(newSteps: WorkflowSteps) {
    await onUpdateWorkflow(chatMessageId, { workflowSteps: newSteps });
  }

  return <WorkflowPanel steps={steps} onUpdate={handleUpdate} />;
}

// --- スレッド表示（チャット風） ---

function ThreadView({
  threadMessages,
  originalSenderName,
}: {
  threadMessages: ChatMessageDetail["threadMessages"];
  originalSenderName: string;
}) {
  if (threadMessages.length === 0) {
    return <p className="text-sm text-muted-foreground">スレッドはありません</p>;
  }

  return (
    <div className="space-y-3">
      {threadMessages.map((tm) => {
        const isOriginalSender = tm.senderName === originalSenderName;
        const initial = tm.senderName?.[0] ?? "?";

        return (
          <div key={tm.id} className={cn("flex gap-2.5", !isOriginalSender && "flex-row-reverse")}>
            {/* アバター */}
            <div
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                isOriginalSender ? "bg-slate-500" : "bg-indigo-500",
              )}
            >
              {initial}
            </div>

            {/* バブル */}
            <div className={cn("max-w-[75%]", !isOriginalSender && "text-right")}>
              <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-medium">{tm.senderName}</span>
                <span>·</span>
                <span>{formatDateTimeJST(tm.createdAt)}</span>
              </div>
              <div
                className={cn(
                  "inline-block rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                  isOriginalSender
                    ? "rounded-tl-sm bg-muted/70 text-foreground"
                    : "rounded-tr-sm bg-indigo-50 text-foreground",
                )}
              >
                {tm.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
