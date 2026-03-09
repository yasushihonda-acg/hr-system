import type { ResponseStatus, TaskPriority } from "@hr-system/shared";
import Link from "next/link";
import { getChatMessages, getLineMessages } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TaskDetailPanel } from "./task-detail-panel";
import type { TaskItem } from "./task-list";
import { TaskList, taskCompositeId } from "./task-list";

type Source = "all" | "gchat" | "line";

const PRIORITY_TABS: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "critical", label: "極高" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

const SOURCE_TABS: { value: Source; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "gchat", label: "Google Chat" },
  { value: "line", label: "LINE" },
];

const STATUS_TABS: { value: ResponseStatus | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "unresponded", label: "未対応" },
  { value: "in_progress", label: "対応中" },
  { value: "responded", label: "対応済" },
];

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface Props {
  searchParams: Promise<{
    priority?: string;
    source?: string;
    status?: string;
    id?: string;
  }>;
}

export default async function TaskBoardPage({ searchParams }: Props) {
  const params = await searchParams;
  const priorityFilter = (params.priority as TaskPriority | undefined) ?? undefined;
  const sourceFilter: Source = (params.source as Source) ?? "all";
  const statusFilter = (params.status as ResponseStatus | undefined) ?? undefined;
  const selectedId = params.id ?? null;

  // 両ソースを並列取得
  const [chatResult, lineResult] = await Promise.all([
    sourceFilter !== "line" ? getChatMessages({ limit: 200 }) : null,
    sourceFilter !== "gchat" ? getLineMessages({ limit: 200 }) : null,
  ]);

  // タスク優先度付きメッセージを抽出・統合
  const tasks: TaskItem[] = [];

  if (chatResult) {
    for (const msg of chatResult.data) {
      const priority = msg.intent?.taskPriority;
      if (!priority) continue;
      tasks.push({
        id: msg.id,
        source: "gchat",
        senderName: msg.senderName,
        content: msg.content,
        taskPriority: priority,
        responseStatus: (msg.intent?.responseStatus ?? "unresponded") as ResponseStatus,
        taskSummary: msg.intent?.taskSummary ?? null,
        assignees: msg.intent?.assignees ?? null,
        groupName: null,
        createdAt: msg.createdAt,
      });
    }
  }

  if (lineResult) {
    for (const msg of lineResult.data) {
      if (!msg.taskPriority) continue;
      tasks.push({
        id: msg.id,
        source: "line",
        senderName: msg.senderName,
        content: msg.content,
        taskPriority: msg.taskPriority,
        responseStatus: msg.responseStatus,
        taskSummary: null,
        assignees: null,
        groupName: msg.groupName,
        createdAt: msg.createdAt,
      });
    }
  }

  // フィルタリング
  let filtered = tasks;
  if (priorityFilter) {
    filtered = filtered.filter((t) => t.taskPriority === priorityFilter);
  }
  if (statusFilter) {
    filtered = filtered.filter((t) => t.responseStatus === statusFilter);
  }

  // 優先度順 → 日時降順でソート
  filtered.sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.taskPriority] - PRIORITY_ORDER[b.taskPriority];
    if (pDiff !== 0) return pDiff;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const criticalCount = filtered.filter((t) => t.taskPriority === "critical").length;

  // 選択されたタスクを検索
  const selectedTask = selectedId
    ? (filtered.find((t) => taskCompositeId(t) === selectedId) ?? null)
    : null;

  function buildUrl(overrides: { priority?: string; source?: string; status?: string }) {
    const sp = new URLSearchParams();
    const p = "priority" in overrides ? overrides.priority : params.priority;
    const src = "source" in overrides ? overrides.source : params.source;
    const s = "status" in overrides ? overrides.status : params.status;
    if (p && p !== "all") sp.set("priority", p);
    if (src && src !== "all") sp.set("source", src);
    if (s && s !== "all") sp.set("status", s);
    // フィルター切替時は選択を維持
    if (params.id) sp.set("id", params.id);
    const qs = sp.toString();
    return `/task-board${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-52px)] flex-col">
      {/* ヘッダー（選択中はモバイルで非表示） */}
      <div
        className={cn(
          "flex-shrink-0 border-b border-border/60 bg-white px-5 py-3",
          selectedTask && "hidden lg:block",
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">タスク</h1>
          <span className="text-xs text-muted-foreground">
            {filtered.length}件{criticalCount > 0 && ` (極高 ${criticalCount}件)`}
          </span>
        </div>

        {/* フィルター: 優先度 */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRIORITY_TABS.map((tab) => {
            const isActive = tab.value === "all" ? !priorityFilter : priorityFilter === tab.value;
            return (
              <Link
                key={tab.value}
                href={buildUrl({ priority: tab.value === "all" ? undefined : tab.value })}
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? tab.value === "critical"
                      ? "bg-red-600 text-white"
                      : "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* フィルター: ソース + ステータス */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {SOURCE_TABS.map((tab) => {
              const isActive = sourceFilter === tab.value;
              return (
                <Link
                  key={tab.value}
                  href={buildUrl({ source: tab.value === "all" ? undefined : tab.value })}
                  className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => {
              const isActive = tab.value === "all" ? !statusFilter : statusFilter === tab.value;
              return (
                <Link
                  key={tab.value}
                  href={buildUrl({ status: tab.value === "all" ? undefined : tab.value })}
                  className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* メインエリア: リスト + 詳細パネル */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左: タスク一覧 (選択中はモバイルで非表示) */}
        <div className={cn("flex-1 overflow-y-auto", selectedTask && "hidden lg:block")}>
          <TaskList tasks={filtered} selectedId={selectedTask ? selectedId : null} />
        </div>

        {/* 右: 詳細パネル */}
        {selectedTask ? (
          <div className="w-full lg:w-[420px] flex-shrink-0 overflow-hidden">
            <TaskDetailPanel task={selectedTask} />
          </div>
        ) : (
          <div className="hidden w-[420px] flex-shrink-0 items-center justify-center border-l border-border/60 bg-muted/10 lg:flex">
            <p className="text-sm text-muted-foreground">タスクを選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}
