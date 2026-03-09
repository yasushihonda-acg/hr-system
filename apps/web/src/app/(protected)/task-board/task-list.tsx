"use client";

import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import { MessageCircle, MessageSquareText } from "lucide-react";
import { TaskPriorityDot } from "@/components/task-priority-selector";
import { useUrlSelection } from "@/hooks/use-url-selection";
import { RESPONSE_STATUS_DOT_COLORS, RESPONSE_STATUS_LABELS } from "@/lib/constants";
import { cn, formatDateTimeJST } from "@/lib/utils";

export interface TaskItem {
  id: string;
  source: "gchat" | "line";
  senderName: string;
  content: string;
  taskPriority: TaskPriority;
  responseStatus: ResponseStatus;
  taskSummary: string | null;
  assignees: string | null;
  groupName: string | null;
  createdAt: string;
}

export function taskCompositeId(task: Pick<TaskItem, "source" | "id">): string {
  return `${task.source}-${task.id}`;
}

export function TaskList({ tasks, selectedId }: { tasks: TaskItem[]; selectedId: string | null }) {
  const selectTask = useUrlSelection("/task-board");

  if (tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">タスクはありません</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {tasks.map((task) => {
        const isCritical = task.taskPriority === "critical";
        const compositeId = taskCompositeId(task);
        const isSelected = compositeId === selectedId;

        return (
          <button
            key={compositeId}
            type="button"
            onClick={() => selectTask(compositeId)}
            className={cn(
              "block w-full text-left px-5 py-3 transition-colors hover:bg-accent/50",
              isCritical && "border-l-4 border-l-red-500 bg-red-50/50 hover:bg-red-50",
              isSelected && !isCritical && "bg-accent",
              isSelected && isCritical && "bg-red-100/70",
            )}
          >
            <div className="flex items-center gap-2">
              {/* 対応状況ドット */}
              <span
                className={cn(
                  "h-2 w-2 flex-shrink-0 rounded-full",
                  RESPONSE_STATUS_DOT_COLORS[task.responseStatus],
                )}
              />
              {/* 優先度 */}
              <TaskPriorityDot priority={task.taskPriority} />
              {/* 送信者名 */}
              <span className={cn("text-xs font-medium", isCritical && "text-red-800")}>
                {task.senderName}
              </span>
              {/* ソースアイコン */}
              {task.source === "gchat" ? (
                <MessageSquareText size={12} className="text-muted-foreground" />
              ) : (
                <MessageCircle size={12} className="text-emerald-500" />
              )}
              {task.groupName && (
                <span className="text-xs text-muted-foreground">@ {task.groupName}</span>
              )}
              {/* 対応状況 */}
              <span className="ml-auto text-xs text-muted-foreground">
                {RESPONSE_STATUS_LABELS[task.responseStatus]}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTimeJST(task.createdAt)}
              </span>
            </div>

            {/* タスク概要 or メッセージ */}
            <p
              className={cn(
                "mt-1 line-clamp-2 text-xs",
                isCritical ? "text-red-700" : "text-muted-foreground",
              )}
            >
              {task.taskSummary || task.content}
            </p>

            {/* 担当者 */}
            {task.assignees && (
              <p className="mt-1 text-xs text-muted-foreground">担当: {task.assignees}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
