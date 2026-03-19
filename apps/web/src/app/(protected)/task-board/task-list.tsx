"use client";

import {
  CHAT_CATEGORIES,
  RESPONSE_STATUSES,
  type ResponseStatus,
  type TaskPriority,
  type WorkflowStepStatus,
  type WorkflowSteps,
} from "@hr-system/shared";
import {
  ClipboardEdit,
  ExternalLink,
  FileText,
  MessageCircle,
  MessageSquareText,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CATEGORY_LABELS,
  RESPONSE_STATUS_BADGE_COLORS,
  RESPONSE_STATUS_LABELS,
} from "@/lib/constants";
import { buildMessageSearchUrl, cn, formatDateTimeJST } from "@/lib/utils";
import {
  DEFAULT_STEPS,
  STEP_CYCLE,
  STEP_KEYS,
  STEP_LABELS,
  STEP_STATUS_COLORS,
  STEP_STATUS_LABELS,
} from "@/lib/workflow-steps";
import {
  updateChatAssigneesFromTaskBoard,
  updateChatCategoriesFromTaskBoard,
  updateChatDeadlineFromTaskBoard,
  updateChatTaskSummaryFromTaskBoard,
  updateLineAssigneesFromTaskBoard,
  updateLineCategoriesFromTaskBoard,
  updateLineDeadlineFromTaskBoard,
  updateLineResponseStatusFromTaskBoard,
  updateLineTaskPriorityFromTaskBoard,
  updateLineTaskSummaryFromTaskBoard,
  updateLineWorkflowFromTaskBoard,
  updateManualTaskAction,
  updateManualWorkflowFromTaskBoard,
  updateResponseStatusFromTaskBoard,
  updateTaskPriorityFromTaskBoard,
  updateWorkflowFromTaskBoard,
} from "./actions";
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
  categories: string[];
  workflowSteps: WorkflowSteps | null;
  notes: string | null;
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

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; dotClass: string }[] = [
  { value: "critical", label: "極高", dotClass: "bg-red-500" },
  { value: "high", label: "高", dotClass: "bg-orange-400" },
  { value: "medium", label: "中", dotClass: "bg-blue-400" },
  { value: "low", label: "低", dotClass: "bg-slate-300" },
];

const STATUS_OPTIONS: { value: ResponseStatus; label: string }[] = RESPONSE_STATUSES.map((s) => ({
  value: s,
  label: RESPONSE_STATUS_LABELS[s],
}));

// --- ソート ---
type SortKey =
  | "createdAt"
  | "taskPriority"
  | "taskSummary"
  | "source"
  | "categories"
  | "assignees"
  | "responseStatus"
  | "deadline";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = {
  unresponded: 0,
  in_progress: 1,
  responded: 2,
  pending_confirmation: 3,
  closed: 4,
};

function compareNullable<T>(
  a: T | null | undefined,
  b: T | null | undefined,
  cmp: (a: T, b: T) => number,
  dir: SortDir,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // null は常に末尾
  if (b == null) return -1;
  return dir === "asc" ? cmp(a, b) : cmp(b, a);
}

function sortTasks(tasks: TaskItem[], key: SortKey | null, dir: SortDir): TaskItem[] {
  if (!key) return tasks;
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    switch (key) {
      case "createdAt":
        return dir === "asc"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt);
      case "taskPriority":
        return dir === "asc"
          ? (PRIORITY_ORDER[a.taskPriority] ?? 99) - (PRIORITY_ORDER[b.taskPriority] ?? 99)
          : (PRIORITY_ORDER[b.taskPriority] ?? 99) - (PRIORITY_ORDER[a.taskPriority] ?? 99);
      case "taskSummary":
        return compareNullable(
          a.taskSummary,
          b.taskSummary,
          (x, y) => x.localeCompare(y, "ja"),
          dir,
        );
      case "source":
        return dir === "asc" ? a.source.localeCompare(b.source) : b.source.localeCompare(a.source);
      case "categories": {
        const ca = a.categories[0] ?? null;
        const cb = b.categories[0] ?? null;
        return compareNullable(ca, cb, (x, y) => x.localeCompare(y, "ja"), dir);
      }
      case "assignees":
        return compareNullable(a.assignees, b.assignees, (x, y) => x.localeCompare(y, "ja"), dir);
      case "responseStatus":
        return dir === "asc"
          ? (STATUS_ORDER[a.responseStatus] ?? 99) - (STATUS_ORDER[b.responseStatus] ?? 99)
          : (STATUS_ORDER[b.responseStatus] ?? 99) - (STATUS_ORDER[a.responseStatus] ?? 99);
      case "deadline":
        return compareNullable(a.deadline, b.deadline, (x, y) => x.localeCompare(y), dir);
      default:
        return 0;
    }
  });
  return sorted;
}

export function TaskList({
  tasks,
  selectedId,
  onSelect,
  onOpenDialog,
  pageOffset = 0,
  memberNames = [],
}: {
  tasks: TaskItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenDialog: (id: string) => void;
  pageOffset?: number;
  memberNames?: string[];
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        // 3回目: ソート解除
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedTasks = useMemo(() => sortTasks(tasks, sortKey, sortDir), [tasks, sortKey, sortDir]);

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return <span className="ml-0.5 text-[9px] text-muted-foreground/30">▲▼</span>;
    }
    return <span className="ml-0.5 text-[9px]">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  if (tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">タスクはありません</p>
      </div>
    );
  }

  return (
    <div>
      <table className="w-full min-w-[1800px] text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-border/60">
          <tr>
            <th className="w-10 px-2 py-2.5 text-center font-semibold text-muted-foreground">No</th>
            <th className="w-8 px-1 py-2.5 text-center font-semibold text-muted-foreground">
              <span className="sr-only">詳細</span>
            </th>
            <th
              className="w-20 px-2 py-2.5 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("createdAt")}
            >
              発生日{sortIndicator("createdAt")}
            </th>
            <th
              className="w-14 px-2 py-2.5 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("taskPriority")}
            >
              優先度{sortIndicator("taskPriority")}
            </th>
            <th className="min-w-[180px] px-2 py-2.5 text-left font-semibold text-muted-foreground">
              記事のコピー
            </th>
            <th className="w-12 px-2 py-2.5 text-center font-semibold text-muted-foreground">
              URL
            </th>
            <th
              className="min-w-[140px] px-2 py-2.5 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("taskSummary")}
            >
              タスク{sortIndicator("taskSummary")}
            </th>
            <th
              className="w-16 px-2 py-2.5 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("source")}
            >
              ソース{sortIndicator("source")}
            </th>
            <th
              className="w-28 px-2 py-2.5 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("categories")}
            >
              カテゴリ{sortIndicator("categories")}
            </th>
            <th
              className="w-24 px-2 py-2.5 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("assignees")}
            >
              割り振り{sortIndicator("assignees")}
            </th>
            <th
              className="w-20 px-2 py-2.5 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("responseStatus")}
            >
              ステータス{sortIndicator("responseStatus")}
            </th>
            <th
              className="w-24 px-2 py-2.5 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:bg-slate-100 transition-colors"
              onClick={() => handleSort("deadline")}
            >
              期限{sortIndicator("deadline")}
            </th>
            {STEP_KEYS.map((key) => (
              <th
                key={key}
                className="w-36 px-1 py-2.5 text-center font-semibold text-muted-foreground"
                title={STEP_LABELS[key].label}
              >
                <span className="block text-[10px] leading-tight">
                  {STEP_LABELS[key].shortLabel}
                </span>
              </th>
            ))}
            <th className="min-w-[100px] px-2 py-2.5 text-left font-semibold text-muted-foreground">
              メモ
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {sortedTasks.map((task, index) => (
            <TaskRow
              key={taskCompositeId(task)}
              task={task}
              index={index}
              pageOffset={pageOffset}
              selectedId={selectedId}
              onSelect={onSelect}
              onOpenDialog={onOpenDialog}
              memberNames={memberNames}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskRow({
  task,
  index,
  pageOffset,
  selectedId,
  onSelect,
  onOpenDialog,
  memberNames,
}: {
  task: TaskItem;
  index: number;
  pageOffset: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenDialog: (id: string) => void;
  memberNames: string[];
}) {
  const isCritical = task.taskPriority === "critical";
  const compositeId = taskCompositeId(task);
  const isSelected = compositeId === selectedId;
  const [isPending, startTransition] = useTransition();
  const [localSteps, setLocalSteps] = useState<WorkflowSteps>(
    task.workflowSteps ?? { ...DEFAULT_STEPS },
  );
  const [localNotes, setLocalNotes] = useState(task.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(task.notes ?? "");
  const [localTaskSummary, setLocalTaskSummary] = useState(task.taskSummary ?? "");
  const [savedTaskSummary, setSavedTaskSummary] = useState(task.taskSummary ?? "");
  const [localAssignees, setLocalAssignees] = useState(task.assignees ?? "");
  const [assigneesOpen, setAssigneesOpen] = useState(false);
  const assigneesRef = useRef<HTMLDivElement>(null);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const priorityRef = useRef<HTMLDivElement>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalSteps(task.workflowSteps ?? { ...DEFAULT_STEPS });
    setLocalNotes(task.notes ?? "");
    setSavedNotes(task.notes ?? "");
    setLocalTaskSummary(task.taskSummary ?? "");
    setSavedTaskSummary(task.taskSummary ?? "");
    setLocalAssignees(task.assignees ?? "");
  }, [task.workflowSteps, task.notes, task.taskSummary, task.assignees]);

  // Popover外クリックで閉じる
  useEffect(() => {
    if (!priorityOpen && !categoryOpen && !assigneesOpen) return;
    const handler = (e: MouseEvent) => {
      if (priorityOpen && priorityRef.current && !priorityRef.current.contains(e.target as Node)) {
        setPriorityOpen(false);
      }
      if (categoryOpen && categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
      if (
        assigneesOpen &&
        assigneesRef.current &&
        !assigneesRef.current.contains(e.target as Node)
      ) {
        setAssigneesOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [priorityOpen, categoryOpen, assigneesOpen]);

  const saveWorkflow = async (body: { workflowSteps?: WorkflowSteps; notes?: string | null }) => {
    switch (task.source) {
      case "gchat":
        await updateWorkflowFromTaskBoard(task.id, body);
        break;
      case "line":
        await updateLineWorkflowFromTaskBoard(task.id, body);
        break;
      case "manual":
        await updateManualWorkflowFromTaskBoard(task.id, body);
        break;
      default: {
        const _exhaustive: never = task.source;
        throw new Error(`Unknown source: ${_exhaustive}`);
      }
    }
  };

  const handleStepChange = (key: keyof WorkflowSteps, value: WorkflowStepStatus) => {
    const newSteps = { ...localSteps, [key]: value };
    setLocalSteps(newSteps);
    startTransition(async () => {
      await saveWorkflow({ workflowSteps: newSteps });
    });
  };

  const handleNotesBlur = () => {
    if (localNotes === savedNotes) return;
    setSavedNotes(localNotes);
    startTransition(async () => {
      await saveWorkflow({ notes: localNotes || null });
    });
  };

  // --- 優先度変更 ---
  const handlePriorityChange = (value: TaskPriority) => {
    setPriorityOpen(false);
    startTransition(async () => {
      switch (task.source) {
        case "gchat":
          await updateTaskPriorityFromTaskBoard(task.id, value);
          break;
        case "line":
          await updateLineTaskPriorityFromTaskBoard(task.id, value);
          break;
        case "manual":
          await updateManualTaskAction(task.id, { taskPriority: value });
          break;
        default: {
          const _exhaustive: never = task.source;
          throw new Error(`Unknown source: ${_exhaustive}`);
        }
      }
    });
  };

  // --- タスク要約変更 ---
  const handleTaskSummaryBlur = () => {
    if (localTaskSummary === savedTaskSummary) return;
    setSavedTaskSummary(localTaskSummary);
    startTransition(async () => {
      const value = localTaskSummary || null;
      switch (task.source) {
        case "gchat":
          await updateChatTaskSummaryFromTaskBoard(task.id, value);
          break;
        case "line":
          await updateLineTaskSummaryFromTaskBoard(task.id, value);
          break;
        case "manual":
          await updateManualTaskAction(task.id, { title: localTaskSummary || "無題" });
          break;
        default: {
          const _exhaustive: never = task.source;
          throw new Error(`Unknown source: ${_exhaustive}`);
        }
      }
    });
  };

  // --- カテゴリ変更 ---
  const handleCategoryToggle = (cat: string) => {
    const current = task.categories;
    const newCats = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    if (newCats.length === 0) return; // 最低1つ必要
    startTransition(async () => {
      switch (task.source) {
        case "gchat":
          await updateChatCategoriesFromTaskBoard(task.id, newCats);
          break;
        case "line":
          await updateLineCategoriesFromTaskBoard(task.id, newCats);
          break;
        case "manual":
          await updateManualTaskAction(task.id, { categories: newCats });
          break;
        default: {
          const _exhaustive: never = task.source;
          throw new Error(`Unknown source: ${_exhaustive}`);
        }
      }
    });
  };

  // --- 担当者選択 ---
  const handleAssigneeSelect = (name: string) => {
    setLocalAssignees(name);
    setAssigneesOpen(false);
    startTransition(async () => {
      const value = name || null;
      switch (task.source) {
        case "gchat":
          await updateChatAssigneesFromTaskBoard(task.id, value);
          break;
        case "line":
          await updateLineAssigneesFromTaskBoard(task.id, value);
          break;
        case "manual":
          await updateManualTaskAction(task.id, { assignees: value });
          break;
        default: {
          const _exhaustive: never = task.source;
          throw new Error(`Unknown source: ${_exhaustive}`);
        }
      }
    });
  };

  // --- ステータス変更 ---
  const handleStatusChange = (value: ResponseStatus) => {
    startTransition(async () => {
      switch (task.source) {
        case "gchat":
          await updateResponseStatusFromTaskBoard(task.id, value);
          break;
        case "line":
          await updateLineResponseStatusFromTaskBoard(task.id, value);
          break;
        case "manual":
          await updateManualTaskAction(task.id, { responseStatus: value });
          break;
        default: {
          const _exhaustive: never = task.source;
          throw new Error(`Unknown source: ${_exhaustive}`);
        }
      }
    });
  };

  // --- 期限変更 ---
  const handleDeadlineChange = (value: string) => {
    const deadline = value ? new Date(value).toISOString() : null;
    startTransition(async () => {
      switch (task.source) {
        case "gchat":
          await updateChatDeadlineFromTaskBoard(task.id, deadline);
          break;
        case "line":
          await updateLineDeadlineFromTaskBoard(task.id, deadline);
          break;
        case "manual":
          await updateManualTaskAction(task.id, { deadline });
          break;
        default: {
          const _exhaustive: never = task.source;
          throw new Error(`Unknown source: ${_exhaustive}`);
        }
      }
    });
  };

  // 全タスクでワークフローステップを編集可能
  const showSteps = true;

  // ステップ全完了 かつ 対応済でない場合にサジェスト表示
  const allStepsResolved =
    showSteps &&
    STEP_KEYS.every((k) => localSteps[k] === "completed" || localSteps[k] === "not_required");
  const showRespondedSuggestion =
    allStepsResolved &&
    (task.responseStatus === "unresponded" || task.responseStatus === "in_progress");

  const markResponded = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleStatusChange("responded");
  };

  // 期限をinput[type=date]用にフォーマット
  const deadlineDateValue = task.deadline
    ? new Date(task.deadline).toISOString().split("T")[0]
    : "";

  return (
    <tr
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onSelect(isSelected ? null : compositeId)}
      onKeyDown={(e) => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
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
        isPending && "opacity-60",
      )}
    >
      {/* No */}
      <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">
        {pageOffset + index + 1}
      </td>

      {/* 詳細ダイアログ展開 */}
      <td className="px-1 py-2.5 text-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDialog(compositeId);
          }}
          className="inline-flex items-center justify-center rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
          title="詳細をダイアログで表示"
        >
          <FileText size={14} />
        </button>
      </td>

      {/* 発生日 */}
      <td className="px-2 py-2.5 whitespace-nowrap tabular-nums text-muted-foreground">
        {formatDateTimeJST(task.createdAt)}
      </td>

      {/* 優先度（インライン編集 - Popover） */}
      <td className="px-2 py-2.5 text-center">
        <div className="relative inline-flex" ref={priorityRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPriorityOpen(!priorityOpen);
            }}
            disabled={isPending}
            className="cursor-pointer rounded p-1 hover:bg-accent/50 transition-colors"
          >
            {task.taskPriority === "critical" ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[10px] font-bold text-red-700 animate-pulse whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                極高
              </span>
            ) : (
              <span
                className={cn(
                  "block h-2 w-2 rounded-full",
                  PRIORITY_OPTIONS.find((o) => o.value === task.taskPriority)?.dotClass ??
                    "bg-slate-300",
                )}
                title={PRIORITY_OPTIONS.find((o) => o.value === task.taskPriority)?.label}
              />
            )}
          </button>
          {priorityOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full z-50 mt-1 w-20 rounded-md border bg-card shadow-lg">
              <div className="py-1">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePriorityChange(opt.value);
                    }}
                    className={cn(
                      "flex w-full items-center gap-1.5 px-2 py-1 text-[11px] hover:bg-accent transition-colors",
                      task.taskPriority === opt.value && "font-bold",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", opt.dotClass)} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>

      {/* 記事のコピー（メッセージ本文） */}
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={cn("font-medium", isCritical && "text-red-800")}>{task.senderName}</span>
          {task.groupName && <span className="text-muted-foreground">@ {task.groupName}</span>}
        </div>
        <p
          className={cn(
            "mt-0.5 whitespace-pre-wrap leading-relaxed",
            isCritical ? "text-red-700" : "text-muted-foreground",
          )}
        >
          {task.content}
        </p>
      </td>

      {/* チャットURL（検索で別ウィンドウを開く） */}
      <td className="px-2 py-2.5 text-center">
        {task.source === "gchat" && buildMessageSearchUrl(task.content, task.createdAt) ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(
                buildMessageSearchUrl(task.content, task.createdAt),
                "_blank",
                "noopener,noreferrer,width=1400,height=900",
              );
            }}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 cursor-pointer"
            title="Google Chat でメッセージを検索して開く（新しいウィンドウ）"
          >
            <ExternalLink size={13} />
          </button>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      {/* タスク要約（インライン編集） */}
      <td className="px-2 py-1">
        <textarea
          rows={1}
          value={localTaskSummary}
          onChange={(e) => setLocalTaskSummary(e.target.value)}
          onBlur={handleTaskSummaryBlur}
          onClick={(e) => e.stopPropagation()}
          placeholder="タスク要約"
          className={cn(
            "w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium placeholder:text-muted-foreground/40 focus:border-border focus:bg-card focus:outline-none",
            isCritical ? "text-red-700" : "text-foreground",
          )}
        />
      </td>

      {/* ソース */}
      <td className="px-2 py-2.5 text-center">
        <span className="inline-flex items-center gap-1">
          {SOURCE_ICONS[task.source]}
          <span className="text-muted-foreground">{SOURCE_LABELS[task.source]}</span>
        </span>
      </td>

      {/* カテゴリ（インライン編集 - Popover） */}
      <td className="px-2 py-2.5 text-center">
        <div className="relative" ref={categoryRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCategoryOpen(!categoryOpen);
            }}
            className="inline-flex flex-wrap gap-0.5 cursor-pointer rounded px-1 py-0.5 hover:bg-accent/50 transition-colors min-h-[20px] w-full justify-center"
          >
            {task.categories.length > 0 ? (
              task.categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground/40">—</span>
            )}
          </button>
          {categoryOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-md border bg-card shadow-lg">
              <div className="max-h-60 overflow-y-auto py-1">
                {CHAT_CATEGORIES.map((cat) => (
                  <label
                    key={cat}
                    className="flex items-center gap-2 px-2 py-1 text-[11px] hover:bg-accent cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={task.categories.includes(cat)}
                      onChange={() => handleCategoryToggle(cat)}
                      disabled={isPending}
                      className="h-3 w-3 rounded"
                    />
                    {CATEGORY_LABELS[cat] ?? cat}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>

      {/* 割り振り（クリックでリスト選択） */}
      <td className="px-2 py-2.5">
        <div className="relative" ref={assigneesRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAssigneesOpen(!assigneesOpen);
            }}
            disabled={isPending}
            className="w-full cursor-pointer rounded px-1 py-0.5 text-left text-xs hover:bg-accent/50 transition-colors min-h-[20px]"
          >
            {localAssignees ? (
              <span className="text-foreground">{localAssignees}</span>
            ) : (
              <span className="text-muted-foreground/40">—</span>
            )}
          </button>
          {assigneesOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-32 rounded-md border bg-card shadow-lg">
              <div className="max-h-48 overflow-y-auto py-1">
                {memberNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAssigneeSelect(name);
                    }}
                    className={cn(
                      "flex w-full items-center px-2 py-1 text-[11px] hover:bg-accent transition-colors",
                      localAssignees === name && "font-bold",
                    )}
                  >
                    {name}
                  </button>
                ))}
                {localAssignees && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAssigneeSelect("");
                    }}
                    className="flex w-full items-center px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent transition-colors border-t"
                  >
                    クリア
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </td>

      {/* ステータス（インライン編集） */}
      <td className="px-2 py-2.5 text-center">
        <select
          value={task.responseStatus}
          onChange={(e) => {
            e.stopPropagation();
            handleStatusChange(e.target.value as ResponseStatus);
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={isPending}
          className={cn(
            "w-full cursor-pointer rounded border border-transparent px-1 py-0.5 text-[10px] font-medium outline-none hover:border-border focus:border-border transition-colors",
            RESPONSE_STATUS_BADGE_COLORS[task.responseStatus],
          )}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>

      {/* 期限（インライン編集） */}
      <td className="px-2 py-2.5 whitespace-nowrap">
        <input
          type="date"
          value={deadlineDateValue}
          onChange={(e) => {
            e.stopPropagation();
            handleDeadlineChange(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={isPending}
          className={cn(
            "w-full cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] outline-none hover:border-border focus:border-border focus:bg-card transition-colors",
            task.deadline && new Date(task.deadline) < new Date()
              ? "text-red-600 font-medium"
              : "text-muted-foreground",
          )}
        />
      </td>

      {/* ワークフローステップ */}
      {STEP_KEYS.map((key) => {
        const status = localSteps[key];
        const colors = STEP_STATUS_COLORS[status];
        const labels = STEP_STATUS_LABELS[key];
        return (
          <td key={key} className="px-1 py-2.5 text-center">
            {showSteps ? (
              <select
                value={status}
                onChange={(e) => {
                  e.stopPropagation();
                  handleStepChange(key, e.target.value as WorkflowStepStatus);
                }}
                onClick={(e) => e.stopPropagation()}
                disabled={isPending}
                className={cn(
                  "w-full cursor-pointer rounded border px-1 py-1 text-[10px] font-medium outline-none transition-colors",
                  colors.triggerBg,
                  colors.text,
                )}
              >
                {STEP_CYCLE.map((s) => (
                  <option key={s} value={s}>
                    {labels[s]}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-muted-foreground/30">—</span>
            )}
          </td>
        );
      })}

      {/* メモ + ステップ全完了サジェスト */}
      <td className="px-2 py-1">
        <textarea
          rows={1}
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          onBlur={handleNotesBlur}
          onClick={(e) => e.stopPropagation()}
          placeholder="メモ"
          className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-foreground/80 placeholder:text-muted-foreground/40 focus:border-border focus:bg-card focus:outline-none"
        />
        {showRespondedSuggestion && (
          <button
            type="button"
            onClick={markResponded}
            disabled={isPending}
            className="mt-0.5 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 hover:bg-green-100 transition-colors border border-green-200"
          >
            ✓ 対応済にする
          </button>
        )}
      </td>
    </tr>
  );
}
