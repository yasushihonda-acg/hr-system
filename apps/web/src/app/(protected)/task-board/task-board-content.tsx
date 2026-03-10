"use client";

import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import { Calendar, Loader2, Pencil, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { LineMessageDetailPane } from "@/components/line-message-detail-pane";
import { ChatMessageDetailPane } from "@/components/message-detail-pane";
import { ResponseStatusButtons } from "@/components/response-status-buttons";
import { TaskPrioritySelector } from "@/components/task-priority-selector";
import { RESPONSE_STATUS_LABELS } from "@/lib/constants";
import type { ChatMessageDetail, LineMessageDetail } from "@/lib/types";
import { cn, formatDateTimeJST } from "@/lib/utils";
import { HandoverForm } from "../inbox/handover-form";
import {
  deleteManualTaskAction,
  fetchChatMessageDetailAction,
  fetchLineMessageDetailAction,
  updateLineResponseStatusFromTaskBoard,
  updateLineTaskPriorityFromTaskBoard,
  updateManualTaskAction,
  updateResponseStatusFromTaskBoard,
  updateTaskPriorityFromTaskBoard,
  updateWorkflowFromTaskBoard,
} from "./actions";
import { taskCompositeId } from "./task-composite-id";
import type { TaskItem } from "./task-list";
import { TaskList } from "./task-list";

interface Props {
  tasks: TaskItem[];
  initialSelectedId: string | null;
  children: React.ReactNode;
}

/**
 * タスクボードのメインコンテンツ（クライアントコンポーネント）。
 *
 * 選択状態を useState で管理し、URL 同期は history.replaceState で行う。
 * タスク選択時に Server Action 経由で詳細データを取得し、受信箱と同等の
 * DetailPane を表示する。
 */
export function TaskBoardContent({ tasks, initialSelectedId, children }: Props) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [chatDetail, setChatDetail] = useState<ChatMessageDetail | null>(null);
  const [lineDetail, setLineDetail] = useState<LineMessageDetail | null>(null);
  const [isPending, startTransition] = useTransition();
  const isInitialMount = useRef(true);

  const selectedTask = selectedId
    ? (tasks.find((t) => taskCompositeId(t) === selectedId) ?? null)
    : null;

  // URL 同期（ナビゲーションなし）— 初回マウントはスキップ
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const url = new URL(window.location.href);
    if (selectedId) {
      url.searchParams.set("id", selectedId);
    } else {
      url.searchParams.delete("id");
    }
    window.history.replaceState(window.history.state ?? {}, "", url.toString());
  }, [selectedId]);

  // タスク選択時に詳細データを取得
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedTask 全体を依存にすると参照が毎レンダー変わり無限ループになるため id+source で制御
  useEffect(() => {
    if (!selectedTask) {
      setChatDetail(null);
      setLineDetail(null);
      return;
    }

    // 手動タスクは一覧データに全情報が含まれるため、API呼び出し不要
    if (selectedTask.source === "manual") {
      setChatDetail(null);
      setLineDetail(null);
      return;
    }

    startTransition(async () => {
      try {
        if (selectedTask.source === "gchat") {
          const detail = await fetchChatMessageDetailAction(selectedTask.id);
          setChatDetail(detail);
          setLineDetail(null);
        } else {
          const detail = await fetchLineMessageDetailAction(selectedTask.id);
          setLineDetail(detail);
          setChatDetail(null);
        }
      } catch (err) {
        console.error("Failed to fetch message detail:", err);
        setChatDetail(null);
        setLineDetail(null);
      }
    });
  }, [selectedTask?.id, selectedTask?.source]);

  const handleClose = useCallback(() => {
    setSelectedId(null);
  }, []);

  const isManualTask = selectedTask?.source === "manual";
  const hasDetail = chatDetail || lineDetail || isManualTask;

  return (
    <>
      {/* フィルターヘッダー（選択中はモバイルで非表示） */}
      <div
        className={cn(
          "flex-shrink-0 border-b border-border/60 bg-white px-5 py-3",
          selectedTask && "hidden md:block",
        )}
      >
        {children}
      </div>

      {/* メインエリア: リスト + 詳細ペイン */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左: タスク一覧 (選択中はモバイルで非表示、lg ではリスト幅を固定) */}
        <div
          className={cn(
            "overflow-y-auto",
            selectedTask
              ? "hidden md:block md:w-[320px] md:flex-shrink-0 md:border-r md:border-border/60"
              : "flex-1",
          )}
        >
          <TaskList
            tasks={tasks}
            selectedId={selectedTask ? selectedId : null}
            onSelect={setSelectedId}
          />
        </div>

        {/* 右: 詳細ペイン（タスク選択時のみ表示） */}
        {selectedTask && (
          <div className="flex flex-1 overflow-hidden">
            {isPending || !hasDetail ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">読み込み中...</p>
                </div>
              </div>
            ) : chatDetail ? (
              <ChatMessageDetailPane
                message={chatDetail}
                onClose={handleClose}
                onUpdateResponseStatus={updateResponseStatusFromTaskBoard}
                onUpdateTaskPriority={updateTaskPriorityFromTaskBoard}
                onUpdateWorkflow={updateWorkflowFromTaskBoard}
                extraContent={
                  chatDetail.intent && (
                    <div className="mt-4">
                      <HandoverForm
                        chatMessageId={chatDetail.id}
                        taskSummary={chatDetail.intent.taskSummary ?? null}
                        assignees={chatDetail.intent.assignees ?? null}
                        deadline={chatDetail.intent.deadline ?? null}
                        notes={chatDetail.intent.notes ?? null}
                      />
                    </div>
                  )
                }
              />
            ) : lineDetail ? (
              <LineMessageDetailPane
                message={lineDetail}
                onClose={handleClose}
                onUpdateResponseStatus={updateLineResponseStatusFromTaskBoard}
                onUpdateTaskPriority={updateLineTaskPriorityFromTaskBoard}
              />
            ) : isManualTask && selectedTask ? (
              <ManualTaskDetailPane task={selectedTask} onClose={handleClose} />
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

/** 手動タスクの詳細ペイン */
function ManualTaskDetailPane({ task, onClose }: { task: TaskItem; onClose: () => void }) {
  const [isUpdating, startUpdate] = useTransition();
  const [editingAssignees, setEditingAssignees] = useState(false);
  const [localAssignees, setLocalAssignees] = useState(task.assignees ?? "");
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [localDeadline, setLocalDeadline] = useState(
    task.deadline ? task.deadline.slice(0, 10) : "",
  );

  const handleResponseStatusChange = (status: ResponseStatus) => {
    startUpdate(async () => {
      await updateManualTaskAction(task.id, { responseStatus: status });
    });
  };

  const handlePriorityChange = (priority: TaskPriority | null) => {
    if (!priority) return;
    startUpdate(async () => {
      await updateManualTaskAction(task.id, { taskPriority: priority });
    });
  };

  const handleDelete = () => {
    if (!window.confirm("このタスクを削除しますか？")) return;
    startUpdate(async () => {
      await deleteManualTaskAction(task.id);
      onClose();
    });
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <h2 className="text-sm font-semibold">手入力タスク</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-4 p-5">
        {/* タイトル */}
        <div>
          <h3 className="text-base font-bold">{task.taskSummary || task.content}</h3>
          {task.taskSummary && task.content !== task.taskSummary && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{task.content}</p>
          )}
        </div>

        {/* メタ情報 */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-16 text-muted-foreground">作成者</span>
            <span>{task.senderName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 text-muted-foreground">作成日</span>
            <span>{formatDateTimeJST(task.createdAt)}</span>
          </div>
          {/* 担当者（インライン編集） */}
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="w-16 text-muted-foreground">担当者</span>
            {editingAssignees ? (
              <form
                className="ml-auto flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  setEditingAssignees(false);
                  startUpdate(async () => {
                    await updateManualTaskAction(task.id, {
                      assignees: localAssignees || null,
                    });
                  });
                }}
              >
                <input
                  type="text"
                  value={localAssignees}
                  onChange={(e) => setLocalAssignees(e.target.value)}
                  placeholder="担当者名"
                  className="w-32 rounded border border-border bg-background px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--gradient-from)]"
                />
                <button
                  type="submit"
                  className="rounded px-1.5 py-0.5 text-xs text-[var(--gradient-from)] hover:bg-accent"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAssignees(false);
                    setLocalAssignees(task.assignees ?? "");
                  }}
                  className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="ml-auto flex items-center gap-1 hover:text-[var(--gradient-from)]"
                onClick={() => setEditingAssignees(true)}
              >
                {task.assignees || <span className="text-muted-foreground/50 italic">未設定</span>}
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* 期限（インライン編集） */}
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="w-16 text-muted-foreground">期限</span>
            {editingDeadline ? (
              <form
                className="ml-auto flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  setEditingDeadline(false);
                  startUpdate(async () => {
                    await updateManualTaskAction(task.id, {
                      deadline: localDeadline ? `${localDeadline}T00:00:00+09:00` : null,
                    });
                  });
                }}
              >
                <input
                  type="date"
                  value={localDeadline}
                  onChange={(e) => setLocalDeadline(e.target.value)}
                  className="w-32 rounded border border-border bg-background px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--gradient-from)]"
                />
                <button
                  type="submit"
                  className="rounded px-1.5 py-0.5 text-xs text-[var(--gradient-from)] hover:bg-accent"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDeadline(false);
                    setLocalDeadline(task.deadline ? task.deadline.slice(0, 10) : "");
                  }}
                  className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="ml-auto flex items-center gap-1 hover:text-[var(--gradient-from)]"
                onClick={() => setEditingDeadline(true)}
              >
                {task.deadline ? (
                  task.deadline.slice(0, 10)
                ) : (
                  <span className="text-muted-foreground/50 italic">未設定</span>
                )}
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-16 text-muted-foreground">状況</span>
            <span>{RESPONSE_STATUS_LABELS[task.responseStatus]}</span>
          </div>
        </div>

        {/* 優先度セレクタ */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">優先度</p>
          <TaskPrioritySelector value={task.taskPriority} onChange={handlePriorityChange} />
        </div>

        {/* 対応状況 */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">対応状況</p>
          <ResponseStatusButtons
            currentStatus={task.responseStatus}
            onChangeStatus={handleResponseStatusChange}
            disabled={isUpdating}
          />
        </div>

        {/* 削除ボタン */}
        <div className="pt-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isUpdating}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
          >
            タスクを削除
          </button>
        </div>
      </div>
    </div>
  );
}
