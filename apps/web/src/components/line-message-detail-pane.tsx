"use client";

import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CategoriesField } from "@/components/categories-field";
import { AssigneesField, DeadlineField } from "@/components/inline-edit-field";
import { NotesField } from "@/components/notes-field";
import { PriorityClearDialog } from "@/components/priority-clear-dialog";
import { ResponseStatusButtons } from "@/components/response-status-buttons";
import { TaskPrioritySelector } from "@/components/task-priority-selector";
import type { LineMessageDetail } from "@/lib/types";
import { formatDateTimeJST } from "@/lib/utils";

interface LineMessageDetailPaneProps {
  message: LineMessageDetail;
  onClose: () => void;
  onUpdateResponseStatus: (id: string, status: ResponseStatus) => Promise<void>;
  onUpdateTaskPriority: (id: string, priority: TaskPriority | null) => Promise<void>;
  onUpdateAssignees: (id: string, assignees: string | null) => Promise<void>;
  onUpdateDeadline: (id: string, deadline: string | null) => Promise<void>;
  onUpdateCategories: (id: string, categories: string[]) => Promise<void>;
  onUpdateNotes?: (id: string, notes: string | null) => Promise<void>;
  showTaskRemove?: boolean;
}

export function LineMessageDetailPane({
  message,
  onClose,
  onUpdateResponseStatus,
  onUpdateTaskPriority,
  onUpdateAssignees,
  onUpdateDeadline,
  onUpdateCategories,
  onUpdateNotes,
  showTaskRemove,
}: LineMessageDetailPaneProps) {
  const responseStatus = message.responseStatus;
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const handleConfirmRemove = () => {
    setShowRemoveDialog(false);
    onUpdateTaskPriority(message.id, null);
    toast.success("タスクを解除しました");
  };

  return (
    <div className="p-5">
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
          {message.groupName && (
            <span className="text-xs text-muted-foreground">@ {message.groupName}</span>
          )}
          <CategoriesField
            categories={message.categories}
            onSave={(cats) => onUpdateCategories(message.id, cats)}
          />
          <span className="text-xs text-muted-foreground">
            {formatDateTimeJST(message.createdAt)}
          </span>
        </div>
      </div>

      {/* メッセージ本文 */}
      <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
        {message.lineMessageType === "image" && message.contentUrl ? (
          // biome-ignore lint/performance/noImgElement: 外部GCS signed URLのため next/image は不適
          <img
            src={message.contentUrl}
            alt="LINE画像メッセージ"
            className="max-w-full rounded-lg"
          />
        ) : (
          message.content
        )}
      </div>

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
        <div className="flex items-center gap-2">
          <TaskPrioritySelector
            value={message.taskPriority}
            onChange={(p) => p && onUpdateTaskPriority(message.id, p)}
          />
          {(message.taskPriority || showTaskRemove) && (
            <button
              type="button"
              onClick={() => setShowRemoveDialog(true)}
              className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 transition-colors"
            >
              タスク解除
            </button>
          )}
        </div>
        <PriorityClearDialog
          open={showRemoveDialog}
          onConfirm={handleConfirmRemove}
          onCancel={() => setShowRemoveDialog(false)}
        />
      </div>

      {/* 担当者・期限 */}
      <div className="mt-4 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
        <AssigneesField
          value={message.assignees}
          onSave={(v) => onUpdateAssignees(message.id, v)}
        />
        <DeadlineField value={message.deadline} onSave={(v) => onUpdateDeadline(message.id, v)} />
      </div>

      {/* メモ */}
      {onUpdateNotes && (
        <div className="mt-4">
          <NotesField
            value={message.notes ?? null}
            onSave={(notes) => onUpdateNotes(message.id, notes)}
          />
        </div>
      )}

      {/* メタ情報 */}
      <div className="mt-6 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
        <h3 className="text-xs font-bold text-muted-foreground">メッセージ情報</h3>
        <InfoRow label="グループ" value={message.groupName ?? "不明"} />
        <InfoRow label="送信者" value={message.senderName} />
        <InfoRow label="タイプ" value={message.lineMessageType} />
        {message.responseStatusUpdatedBy && (
          <InfoRow
            label="最終更新"
            value={`${message.responseStatusUpdatedBy} (${message.responseStatusUpdatedAt ? formatDateTimeJST(message.responseStatusUpdatedAt) : ""})`}
          />
        )}
      </div>
    </div>
  );
}

// --- 情報行 ---

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
