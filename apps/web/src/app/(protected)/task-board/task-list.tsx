"use client";

import {
  CHAT_CATEGORIES,
  type ResponseStatus,
  RESPONSE_STATUSES,
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
import { useEffect, useRef, useState, useTransition } from "react";
import { TaskPriorityDot } from "@/components/task-priority-selector";
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

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "critical", label: "緊急" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

const STATUS_OPTIONS: { value: ResponseStatus; label: string }[] = RESPONSE_STATUSES.map((s) => ({
  value: s,
  label: RESPONSE_STATUS_LABELS[s],
}));

export function TaskList({
  tasks,
  selectedId,
  onSelect,
  onOpenDialog,
  pageOffset = 0,
}: {
  tasks: TaskItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenDialog: (id: string) => void;
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
    <div>
      <table className="w-full min-w-[1800px] text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-border/60">
          <tr>
            <th className="w-10 px-2 py-2.5 text-center font-semibold text-muted-foreground">No</th>
            <th className="w-8 px-1 py-2.5 text-center font-semibold text-muted-foreground">
              <span className="sr-only">詳細</span>
            </th>
            <th className="w-20 px-2 py-2.5 text-left font-semibold text-muted-foreground">
              発生日
            </th>
            <th className="w-14 px-2 py-2.5 text-center font-semibold text-muted-foreground">
              優先度
            </th>
            <th className="min-w-[180px] px-2 py-2.5 text-left font-semibold text-muted-foreground">
              記事のコピー
            </th>
            <th className="w-12 px-2 py-2.5 text-center font-semibold text-muted-foreground">
              URL
            </th>
            <th className="min-w-[140px] px-2 py-2.5 text-left font-semibold text-muted-foreground">
              タスク
            </th>
            <th className="w-16 px-2 py-2.5 text-center font-semibold text-muted-foreground">
              ソース
            </th>
            <th className="w-28 px-2 py-2.5 text-center font-semibold text-muted-foreground">
              カテゴリ
            </th>
            <th className="w-24 px-2 py-2.5 text-left font-semibold text-muted-foreground">
              割り振り
            </th>
            <th className="w-20 px-2 py-2.5 text-center font-semibold text-muted-foreground">
              ステータス
            </th>
            <th className="w-24 px-2 py-2.5 text-left font-semibold text-muted-foreground">期限</th>
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
          {tasks.map((task, index) => (
            <TaskRow
              key={taskCompositeId(task)}
              task={task}
              index={index}
              pageOffset={pageOffset}
              selectedId={selectedId}
              onSelect={onSelect}
              onOpenDialog={onOpenDialog}
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
}: {
  task: TaskItem;
  index: number;
  pageOffset: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenDialog: (id: string) => void;
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
  const [savedAssignees, setSavedAssignees] = useState(task.assignees ?? "");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalSteps(task.workflowSteps ?? { ...DEFAULT_STEPS });
    setLocalNotes(task.notes ?? "");
    setSavedNotes(task.notes ?? "");
    setLocalTaskSummary(task.taskSummary ?? "");
    setSavedTaskSummary(task.taskSummary ?? "");
    setLocalAssignees(task.assignees ?? "");
    setSavedAssignees(task.assignees ?? "");
  }, [task.workflowSteps, task.notes, task.taskSummary, task.assignees]);

  // カテゴリPopover外クリックで閉じる
  useEffect(() => {
    if (!categoryOpen) return;
    const handler = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [categoryOpen]);

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

  // --- 担当者変更 ---
  const handleAssigneesBlur = () => {
    if (localAssignees === savedAssignees) return;
    setSavedAssignees(localAssignees);
    startTransition(async () => {
      const value = localAssignees || null;
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

      {/* 優先度（インライン編集） */}
      <td className="px-2 py-2.5 text-center">
        <select
          value={task.taskPriority}
          onChange={(e) => {
            e.stopPropagation();
            handlePriorityChange(e.target.value as TaskPriority);
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={isPending}
          className="w-full cursor-pointer rounded border border-transparent bg-transparent px-0.5 py-0.5 text-[10px] font-medium outline-none hover:border-border focus:border-border focus:bg-card transition-colors"
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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

      {/* 割り振り（インライン編集） */}
      <td className="px-2 py-1">
        <input
          type="text"
          value={localAssignees}
          onChange={(e) => setLocalAssignees(e.target.value)}
          onBlur={handleAssigneesBlur}
          onClick={(e) => e.stopPropagation()}
          placeholder="担当者"
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:border-border focus:bg-card focus:outline-none"
        />
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
