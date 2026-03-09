"use client";

import { Loader2, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChatMessageDetailPane } from "@/components/message-detail-pane";
import { LineMessageDetailPane } from "@/components/line-message-detail-pane";
import type { ChatMessageDetail, LineMessageDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  fetchChatMessageDetailAction,
  fetchLineMessageDetailAction,
  updateLineResponseStatusFromTaskBoard,
  updateLineTaskPriorityFromTaskBoard,
  updateResponseStatusFromTaskBoard,
  updateTaskPriorityFromTaskBoard,
  updateWorkflowFromTaskBoard,
} from "./actions";
import { HandoverForm } from "../inbox/handover-form";
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
  useEffect(() => {
    if (!selectedTask) {
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
  }, [selectedTask?.id, selectedTask?.source]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    setSelectedId(null);
  }, []);

  const hasDetail = chatDetail || lineDetail;

  return (
    <>
      {/* フィルターヘッダー（選択中はモバイルで非表示） */}
      <div
        className={cn(
          "flex-shrink-0 border-b border-border/60 bg-white px-5 py-3",
          selectedTask && "hidden lg:block",
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
              ? "hidden lg:block lg:w-[320px] lg:flex-shrink-0 lg:border-r lg:border-border/60"
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
            ) : null}
          </div>
        )}

        {/* 未選択時のプレースホルダー（デスクトップのみ） */}
        {!selectedTask && (
          <div className="hidden flex-1 items-center justify-center lg:flex">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">タスクを選択してください</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
