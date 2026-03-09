/**
 * タスクの複合ID生成ヘルパー。
 * サーバーコンポーネント（page.tsx）とクライアントコンポーネント（task-list.tsx）
 * の両方から使用するため、"use client" なしの独立ファイルに配置。
 */
export function taskCompositeId(task: { source: string; id: string }): string {
  return `${task.source}-${task.id}`;
}
