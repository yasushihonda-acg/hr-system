"use client";

import type { TaskPriority } from "@hr-system/shared";
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  MessageCircle,
  MessageSquareText,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { TaskPriorityDot } from "@/components/task-priority-selector";
import { useUrlSelection } from "@/hooks/use-url-selection";
import { RESPONSE_STATUS_DOT_COLORS, RESPONSE_STATUS_LABELS } from "@/lib/constants";
import { cn, formatDateTimeJST } from "@/lib/utils";
import type { TaskItem } from "./task-list";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: "極高",
  high: "高",
  medium: "中",
  low: "低",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-sky-50 text-sky-700 border-sky-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

export function TaskDetailPanel({ task }: { task: TaskItem }) {
  const select = useUrlSelection("/task-board");
  const close = () => select(null);

  const inboxUrl =
    task.source === "gchat" ? `/inbox?id=${task.id}` : `/inbox?source=line&id=${task.id}`;

  const isCritical = task.taskPriority === "critical";

  return (
    <div className="flex h-full flex-col border-l border-border/60 bg-white">
      {/* ヘッダー */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3",
          isCritical ? "border-red-200 bg-red-50/80" : "border-border/60",
        )}
      >
        <div className="flex items-center gap-2">
          {/* モバイル: 戻るボタン */}
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-muted-foreground hover:bg-accent lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-bold">タスク詳細</h2>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={inboxUrl}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent"
            title="受信箱で開く"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          {/* デスクトップ: 閉じるボタン */}
          <button
            type="button"
            onClick={close}
            className="hidden rounded p-1.5 text-muted-foreground hover:bg-accent lg:block"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 優先度 & ステータス */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              PRIORITY_COLORS[task.taskPriority],
            )}
          >
            <TaskPriorityDot priority={task.taskPriority} />
            {PRIORITY_LABELS[task.taskPriority]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                RESPONSE_STATUS_DOT_COLORS[task.responseStatus],
              )}
            />
            {RESPONSE_STATUS_LABELS[task.responseStatus]}
          </span>
        </div>

        {/* タスク概要 */}
        {task.taskSummary && (
          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground">タスク概要</h3>
            <p className="text-sm leading-relaxed">{task.taskSummary}</p>
          </section>
        )}

        {/* メッセージ本文 */}
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground">メッセージ</h3>
          <div className="rounded-lg bg-muted/50 p-3.5 text-sm leading-relaxed">{task.content}</div>
        </section>

        {/* 情報 */}
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground">情報</h3>
          <div className="rounded-lg border border-border/60 p-3 space-y-2.5 text-xs">
            {/* 送信者 */}
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">送信者</span>
              <span className="ml-auto font-medium">{task.senderName}</span>
            </div>

            {/* ソース */}
            <div className="flex items-center gap-2">
              {task.source === "gchat" ? (
                <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <span className="text-muted-foreground">ソース</span>
              <span className="ml-auto font-medium">
                {task.source === "gchat" ? "Google Chat" : "LINE"}
              </span>
            </div>

            {/* グループ名 */}
            {task.groupName && (
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">グループ</span>
                <span className="ml-auto font-medium">{task.groupName}</span>
              </div>
            )}

            {/* 担当者 */}
            {task.assignees && (
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">担当者</span>
                <span className="ml-auto font-medium">{task.assignees}</span>
              </div>
            )}

            {/* 日時 */}
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">受信日時</span>
              <span className="ml-auto font-medium tabular-nums">
                {formatDateTimeJST(task.createdAt)}
              </span>
            </div>
          </div>
        </section>

        {/* 受信箱で開くボタン */}
        <Link
          href={inboxUrl}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-white px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          受信箱で開く（対応状況変更・スレッド表示）
        </Link>
      </div>
    </div>
  );
}
