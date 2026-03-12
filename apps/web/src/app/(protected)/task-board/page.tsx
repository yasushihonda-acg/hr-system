import type { ChatCategory, ResponseStatus, TaskPriority } from "@hr-system/shared";
import { CHAT_CATEGORIES } from "@hr-system/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getChatMessages, getLineMessages, getManualTasks } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/constants";
import { ManualTaskCreateButton } from "./manual-task-form";
import { TaskBoardContent } from "./task-board-content";
import type { TaskItem } from "./task-list";

type Source = "all" | "gchat" | "line" | "manual";

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
  { value: "manual", label: "手入力" },
];

const STATUS_TABS: { value: ResponseStatus | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "unresponded", label: "未対応" },
  { value: "in_progress", label: "対応中" },
  { value: "responded", label: "対応済" },
];

const CATEGORY_TABS: { value: ChatCategory | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  ...CHAT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c })),
];

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PAGE_SIZE = 30;

interface Props {
  searchParams: Promise<{
    priority?: string;
    source?: string;
    status?: string;
    category?: string;
    page?: string;
    id?: string;
  }>;
}

export default async function TaskBoardPage({ searchParams }: Props) {
  const params = await searchParams;
  const priorityFilter = (params.priority as TaskPriority | undefined) ?? undefined;
  const sourceFilter: Source = (params.source as Source) ?? "all";
  const statusFilter = (params.status as ResponseStatus | undefined) ?? undefined;
  const categoryFilter = (params.category as ChatCategory | undefined) ?? undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const selectedId = params.id ?? null;

  // 全ソースを並列取得（hasTaskPriority でタスク優先度付きのみ取得）
  const [chatResult, lineResult, manualResult] = await Promise.all([
    sourceFilter === "all" || sourceFilter === "gchat"
      ? getChatMessages({ hasTaskPriority: true, limit: 200 })
      : null,
    sourceFilter === "all" || sourceFilter === "line"
      ? getLineMessages({ hasTaskPriority: true, limit: 200 })
      : null,
    sourceFilter === "all" || sourceFilter === "manual" ? getManualTasks({ limit: 200 }) : null,
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
        deadline: msg.intent?.deadline ?? null,
        groupName: null,
        chatUrl: `https://chat.google.com/room/${msg.spaceId}/${msg.googleMessageId}`,
        category: msg.intent?.category ?? null,
        workflowSteps: msg.intent?.workflowSteps ?? null,
        notes: msg.intent?.notes ?? null,
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
        assignees: msg.assignees ?? null,
        deadline: msg.deadline ?? null,
        groupName: msg.groupName,
        chatUrl: null,
        category: null,
        workflowSteps: null,
        notes: null,
        createdAt: msg.createdAt,
      });
    }
  }

  if (manualResult) {
    for (const task of manualResult.data) {
      tasks.push({
        id: task.id,
        source: "manual",
        senderName: task.createdByName,
        content: task.content || task.title,
        taskPriority: task.taskPriority,
        responseStatus: task.responseStatus,
        taskSummary: task.title,
        assignees: task.assignees,
        deadline: task.deadline,
        groupName: null,
        chatUrl: null,
        category: null,
        workflowSteps: null,
        notes: null,
        createdAt: task.createdAt,
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
  if (categoryFilter) {
    filtered = filtered.filter((t) => t.category === categoryFilter);
  }

  // 優先度順 → 日時降順でソート
  filtered.sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.taskPriority] - PRIORITY_ORDER[b.taskPriority];
    if (pDiff !== 0) return pDiff;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const criticalCount = filtered.filter((t) => t.taskPriority === "critical").length;

  // ページネーション
  const totalCount = filtered.length;
  const offset = (page - 1) * PAGE_SIZE;
  const paged = filtered.slice(offset, offset + PAGE_SIZE);
  const hasMore = offset + PAGE_SIZE < totalCount;

  function buildUrl(overrides: {
    priority?: string;
    source?: string;
    status?: string;
    category?: string;
    page?: string;
  }) {
    const sp = new URLSearchParams();
    const p = "priority" in overrides ? overrides.priority : params.priority;
    const src = "source" in overrides ? overrides.source : params.source;
    const s = "status" in overrides ? overrides.status : params.status;
    const cat = "category" in overrides ? overrides.category : params.category;
    const pg = "page" in overrides ? overrides.page : params.page;
    if (p && p !== "all") sp.set("priority", p);
    if (src && src !== "all") sp.set("source", src);
    if (s && s !== "all") sp.set("status", s);
    if (cat && cat !== "all") sp.set("category", cat);
    if (pg && pg !== "1") sp.set("page", pg);
    // フィルター切替時は選択を維持
    if (params.id) sp.set("id", params.id);
    const qs = sp.toString();
    return `/task-board${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-52px)] flex-col">
      <TaskBoardContent tasks={paged} initialSelectedId={selectedId} pageOffset={offset}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight">タスク一覧</h1>
            <ManualTaskCreateButton />
          </div>
          <span className="text-xs text-muted-foreground">
            {totalCount}件{criticalCount > 0 && ` (極高 ${criticalCount}件)`}
          </span>
        </div>

        {/* フィルター: 優先度 */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRIORITY_TABS.map((tab) => {
            const isActive = tab.value === "all" ? !priorityFilter : priorityFilter === tab.value;
            return (
              <Link
                key={tab.value}
                href={buildUrl({
                  priority: tab.value === "all" ? undefined : tab.value,
                  page: "1",
                })}
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
                  href={buildUrl({
                    source: tab.value === "all" ? undefined : tab.value,
                    page: "1",
                  })}
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
                  href={buildUrl({
                    status: tab.value === "all" ? undefined : tab.value,
                    page: "1",
                  })}
                  className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex flex-wrap gap-1">
            {CATEGORY_TABS.map((tab) => {
              const isActive = tab.value === "all" ? !categoryFilter : categoryFilter === tab.value;
              return (
                <Link
                  key={tab.value}
                  href={buildUrl({
                    category: tab.value === "all" ? undefined : tab.value,
                    page: "1",
                  })}
                  className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive ? "bg-slate-600 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </TaskBoardContent>

      {/* ページネーション */}
      {totalCount > PAGE_SIZE && (
        <div className="flex-shrink-0 border-t border-border/60 bg-white px-5 py-2">
          <div className="flex items-center justify-center gap-2">
            <Link
              href={page > 1 ? buildUrl({ page: String(page - 1) }) : "#"}
              aria-disabled={page <= 1}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                page <= 1
                  ? "pointer-events-none text-slate-300"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <ChevronLeft size={16} />
              前へ
            </Link>
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-700">
              ページ {page}
            </span>
            <Link
              href={hasMore ? buildUrl({ page: String(page + 1) }) : "#"}
              aria-disabled={!hasMore}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                !hasMore
                  ? "pointer-events-none text-slate-300"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              次へ
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
