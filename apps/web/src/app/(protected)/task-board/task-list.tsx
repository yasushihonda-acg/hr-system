"use client";

import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import { ClipboardEdit, Clock, MessageCircle, MessageSquareText } from "lucide-react";
import { TaskPriorityDot } from "@/components/task-priority-selector";
import { RESPONSE_STATUS_BADGE_COLORS, RESPONSE_STATUS_LABELS } from "@/lib/constants";
import { cn, formatDateJST, formatDateTimeJST } from "@/lib/utils";
import { taskCompositeId } from "./task-composite-id";

export interface TaskItem {
  id: string;
  source: "gchat" | "line" | "manual";
  senderName: string;
  content: string;
  taskPriority: TaskPriority;
  responseStatus: ResponseStatus;
  taskSummary: string | null;
  assignees: string | null;
  deadline: string | null;
  groupName: string | null;
  createdAt: string;
}

const SOURCE_LABELS: Record<TaskItem["source"], string> = {
  gchat: "Chat",
  line: "LINE",
  manual: "手入力",
};

const SOURCE_ICONS: Record<TaskItem["source"], React.ReactNode> = {
  gchat: <MessageSquareText size={12} className="text-muted-foreground" />,
  line: <MessageCircle size={12} className="text-emerald-500" />,
  manual: <ClipboardEdit size={12} className="text-blue-500" />,
};

export function TaskList({
  tasks,
  selectedId,
  onSelect,
  pageOffset = 0,
}: {
  tasks: TaskItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  pageOffset?: number;
}) {
  if (tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">タスクはありません</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-border/60">
          <tr>
            <th className="w-10 px-2 py-2.5 text-center font-semibold text-muted-foreground">No</th>
            <th className="w-20 px-2 py-2.5 text-left font-semibold text-muted-foreground">
              発生日
            </th>
            <th className="w-14 px-2 py-2.5 text-center font-semibold text-muted-foreground">
              優先度
            </th>
            <th className="min-w-[200px] px-2 py-2.5 text-left font-semibold text-muted-foreground">
              タスク内容
            </th>
            <th className="w-16 px-2 py-2.5 text-center font-semibold text-muted-foreground">
              ソース
            </th>
            <th className="w-24 px-2 py-2.5 text-left font-semibold text-muted-foreground">
              割り振り
            </th>
            <th className="w-20 px-2 py-2.5 text-center font-semibold text-muted-foreground">
              ステータス
            </th>
            <th className="w-20 px-2 py-2.5 text-left font-semibold text-muted-foreground">期限</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {tasks.map((task, index) => {
            const isCritical = task.taskPriority === "critical";
            const compositeId = taskCompositeId(task);
            const isSelected = compositeId === selectedId;

            return (
              <tr
                key={compositeId}
                tabIndex={0}
                aria-selected={isSelected}
                onClick={() => onSelect(isSelected ? null : compositeId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(isSelected ? null : compositeId);
                  }
                }}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isCritical && "bg-red-50/60 hover:bg-red-50",
                  isSelected && !isCritical && "bg-accent",
                  isSelected && isCritical && "bg-red-100/70",
                )}
              >
                {/* No */}
                <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">
                  {pageOffset + index + 1}
                </td>

                {/* 発生日 */}
                <td className="px-2 py-2.5 whitespace-nowrap tabular-nums text-muted-foreground">
                  {formatDateTimeJST(task.createdAt)}
                </td>

                {/* 優先度 */}
                <td className="px-2 py-2.5 text-center">
                  <TaskPriorityDot priority={task.taskPriority} />
                </td>

                {/* タスク内容 */}
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("font-medium", isCritical && "text-red-800")}>
                      {task.senderName}
                    </span>
                    {task.groupName && (
                      <span className="text-muted-foreground">@ {task.groupName}</span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 line-clamp-2 leading-relaxed",
                      isCritical ? "text-red-700" : "text-muted-foreground",
                    )}
                  >
                    {task.taskSummary || task.content}
                  </p>
                </td>

                {/* ソース */}
                <td className="px-2 py-2.5 text-center">
                  <span className="inline-flex items-center gap-1">
                    {SOURCE_ICONS[task.source]}
                    <span className="text-muted-foreground">{SOURCE_LABELS[task.source]}</span>
                  </span>
                </td>

                {/* 割り振り */}
                <td className="px-2 py-2.5 text-muted-foreground">
                  {task.assignees || <span className="text-muted-foreground/40">—</span>}
                </td>

                {/* ステータス */}
                <td className="px-2 py-2.5 text-center">
                  <span
                    className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                      RESPONSE_STATUS_BADGE_COLORS[task.responseStatus],
                    )}
                  >
                    {RESPONSE_STATUS_LABELS[task.responseStatus]}
                  </span>
                </td>

                {/* 期限 */}
                <td className="px-2 py-2.5 whitespace-nowrap">
                  {task.deadline ? (
                    <DeadlineBadge deadline={task.deadline} />
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const isOverdue = new Date(deadline) < new Date();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        isOverdue ? "text-red-600 font-medium" : "text-muted-foreground",
      )}
    >
      <Clock size={11} />
      {formatDateJST(deadline)}
    </span>
  );
}
