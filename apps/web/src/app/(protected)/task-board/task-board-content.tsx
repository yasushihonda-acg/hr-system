"use client";

import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AssigneesField, DeadlineField } from "@/components/inline-edit-field";
import { LineMessageDetailPane } from "@/components/line-message-detail-pane";
import { ChatMessageDetailPane } from "@/components/message-detail-pane";
import { ResponseStatusButtons } from "@/components/response-status-buttons";
import { TaskPrioritySelector } from "@/components/task-priority-selector";
import type { ChatMessageDetail, LineMessageDetail } from "@/lib/types";
import { cn, formatDateTimeJST } from "@/lib/utils";
import { HandoverForm } from "../inbox/handover-form";
import {
  deleteManualTaskAction,
  fetchChatMessageDetailAction,
  fetchLineMessageDetailAction,
  updateChatAssigneesFromTaskBoard,
  updateChatDeadlineFromTaskBoard,
  updateLineAssigneesFromTaskBoard,
  updateLineDeadlineFromTaskBoard,
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

  // 担当者・期限の保存後に詳細データを再取得して表示を更新するラッパー
  const handleChatAssignees = useCallback(async (id: string, assignees: string | null) => {
    await updateChatAssigneesFromTaskBoard(id, assignees);
    const updated = await fetchChatMessageDetailAction(id);
    setChatDetail(updated);
  }, []);

  const handleChatDeadline = useCallback(async (id: string, deadline: string | null) => {
    await updateChatDeadlineFromTaskBoard(id, deadline);
    const updated = await fetchChatMessageDetailAction(id);
    setChatDetail(updated);
  }, []);

  const handleLineAssignees = useCallback(async (id: string, assignees: string | null) => {
    await updateLineAssigneesFromTaskBoard(id, assignees);
    const updated = await fetchLineMessageDetailAction(id);
    setLineDetail(updated);
  }, []);

  const handleLineDeadline = useCallback(async (id: string, deadline: string | null) => {
    await updateLineDeadlineFromTaskBoard(id, deadline);
    const updated = await fetchLineMessageDetailAction(id);
    setLineDetail(updated);
  }, []);

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
                assignees={chatDetail.intent?.assignees ?? null}
                deadline={chatDetail.intent?.deadline ?? null}
                onUpdateAssignees={handleChatAssignees}
                onUpdateDeadline={handleChatDeadline}
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
                onUpdateAssignees={handleLineAssignees}
                onUpdateDeadline={handleLineDeadline}
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
  const [localAssignees, setLocalAssignees] = useState(task.assignees);
  const [localDeadline, setLocalDeadline] = useState(task.deadline);

  // 別タスクに切り替わったら同期
  useEffect(() => {
    setLocalAssignees(task.assignees);
    setLocalDeadline(task.deadline);
  }, [task.id, task.assignees, task.deadline]);

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
    <div className="flex flex-1 overflow-hidden">
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
            <h2 className="text-base font-bold">{task.taskSummary || task.content}</h2>
            <span className="text-xs text-muted-foreground">
              {formatDateTimeJST(task.createdAt)}
            </span>
          </div>
        </div>

        {/* タスク内容 */}
        {task.taskSummary && task.content !== task.taskSummary && (
          <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">{task.content}</div>
        )}

        {/* 対応状況 */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">対応状況</p>
          <ResponseStatusButtons
            currentStatus={task.responseStatus}
            onChangeStatus={handleResponseStatusChange}
            disabled={isUpdating}
          />
        </div>

        {/* タスク優先度 */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">タスク優先度</p>
          <TaskPrioritySelector value={task.taskPriority} onChange={handlePriorityChange} />
        </div>

        {/* 担当者・期限 */}
        <div className="mt-4 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <AssigneesField
            value={localAssignees}
            onSave={async (v) => {
              await updateManualTaskAction(task.id, { assignees: v });
              setLocalAssignees(v);
            }}
          />
          <DeadlineField
            value={localDeadline}
            onSave={async (v) => {
              await updateManualTaskAction(task.id, { deadline: v });
              setLocalDeadline(v);
            }}
          />
        </div>

        {/* タスク情報 */}
        <div className="mt-6 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <h3 className="text-xs font-bold text-muted-foreground">タスク情報</h3>
          <InfoRow label="作成者" value={task.senderName} />
          <InfoRow label="作成日" value={formatDateTimeJST(task.createdAt)} />
        </div>

        {/* 削除ボタン */}
        <div className="mt-6">
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
