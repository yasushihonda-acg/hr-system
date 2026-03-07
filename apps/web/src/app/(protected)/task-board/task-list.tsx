"use client";

import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import { MessageCircle, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { TaskPriorityDot } from "@/components/task-priority-selector";
import { RESPONSE_STATUS_DOT_COLORS } from "@/lib/constants";
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

const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  unresponded: "未対応",
  in_progress: "対応中",
  responded: "対応済",
  not_required: "対応不要",
};

export function TaskList({ tasks }: { tasks: TaskItem[] }) {
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
        const inboxUrl =
          task.source === "gchat" ? `/inbox?id=${task.id}` : `/inbox?source=line&id=${task.id}`;

        return (
          <Link
            key={`${task.source}-${task.id}`}
            href={inboxUrl}
            className={cn(
              "block px-5 py-3 transition-colors hover:bg-accent/50",
              isCritical && "border-l-4 border-l-red-500 bg-red-50/50 hover:bg-red-50",
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
                <span className="text-[10px] text-muted-foreground">@ {task.groupName}</span>
              )}
              {/* 対応状況 */}
              <span className="ml-auto text-[10px] text-muted-foreground">
                {RESPONSE_STATUS_LABELS[task.responseStatus]}
              </span>
              <span className="text-[10px] text-muted-foreground">
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
              <p className="mt-1 text-[10px] text-muted-foreground">担当: {task.assignees}</p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
