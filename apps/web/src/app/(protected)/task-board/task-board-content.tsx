"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { taskCompositeId } from "./task-composite-id";
import { TaskDetailPanel } from "./task-detail-panel";
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
 * これによりタスク選択時のサーバー再フェッチを回避する。
 */
export function TaskBoardContent({ tasks, initialSelectedId, children }: Props) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const isInitialMount = useRef(true);

  // URL 同期（ナビゲーションなし）— 初回マウントはスキップ（SSR 時点で URL は正しい）
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

  const selectedTask = selectedId
    ? (tasks.find((t) => taskCompositeId(t) === selectedId) ?? null)
    : null;

  const handleClose = useCallback(() => {
    setSelectedId(null);
  }, []);

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

      {/* メインエリア: リスト + 詳細パネル */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左: タスク一覧 (選択中はモバイルで非表示) */}
        <div className={cn("flex-1 overflow-y-auto", selectedTask && "hidden lg:block")}>
          <TaskList
            tasks={tasks}
            selectedId={selectedTask ? selectedId : null}
            onSelect={setSelectedId}
          />
        </div>

        {/* 右: 詳細パネル（タスク選択時のみ表示） */}
        {selectedTask && (
          <div className="w-full lg:w-[420px] flex-shrink-0 overflow-hidden">
            <TaskDetailPanel task={selectedTask} onClose={handleClose} />
          </div>
        )}
      </div>
    </>
  );
}
