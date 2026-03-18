"use client";

import type {
  ResponseStatus,
  TaskPriority,
  WorkflowStepStatus,
  WorkflowSteps,
} from "@hr-system/shared";
import {
  ClipboardEdit,
  Clock,
  ExternalLink,
  FileText,
  MessageCircle,
  MessageSquareText,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { TaskPriorityDot } from "@/components/task-priority-selector";
import {
  CATEGORY_LABELS,
  RESPONSE_STATUS_BADGE_COLORS,
  RESPONSE_STATUS_LABELS,
} from "@/lib/constants";
import { buildMessageSearchUrl, cn, formatDateJST, formatDateTimeJST } from "@/lib/utils";
import {
  DEFAULT_STEPS,
  STEP_CYCLE,
  STEP_KEYS,
  STEP_LABELS,
  STEP_STATUS_COLORS,
  STEP_STATUS_LABELS,
} from "@/lib/workflow-steps";
import {
  updateLineResponseStatusFromTaskBoard,
  updateLineWorkflowFromTaskBoard,
  updateManualTaskAction,
  updateManualWorkflowFromTaskBoard,
  updateResponseStatusFromTaskBoard,
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
            <th className="w-20 px-2 py-2.5 text-center font-semibold text-muted-foreground">
              カテゴリ
            </th>
            <th className="w-24 px-2 py-2.5 text-left font-semibold text-muted-foreground">
              割り振り
            </th>
            <th className="w-20 px-2 py-2.5 text-center font-semibold text-muted-foreground">
              ステータス
            </th>
            <th className="w-20 px-2 py-2.5 text-left font-semibold text-muted-foreground">期限</th>
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

  useEffect(() => {
    setLocalSteps(task.workflowSteps ?? { ...DEFAULT_STEPS });
    setLocalNotes(task.notes ?? "");
    setSavedNotes(task.notes ?? "");
  }, [task.workflowSteps, task.notes]);

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
    startTransition(async () => {
      switch (task.source) {
        case "gchat":
          await updateResponseStatusFromTaskBoard(task.id, "responded");
          break;
        case "line":
          await updateLineResponseStatusFromTaskBoard(task.id, "responded");
          break;
        case "manual":
          await updateManualTaskAction(task.id, { responseStatus: "responded" });
          break;
        default: {
          const _exhaustive: never = task.source;
          throw new Error(`Unknown source: ${_exhaustive}`);
        }
      }
    });
  };

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

      {/* 優先度 */}
      <td className="px-2 py-2.5 text-center">
        <TaskPriorityDot priority={task.taskPriority} />
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

      {/* タスク（AI抽出要約） */}
      <td className="px-2 py-2.5">
        {task.taskSummary ? (
          <p
            className={cn(
              "line-clamp-2 leading-relaxed font-medium",
              isCritical ? "text-red-700" : "text-foreground",
            )}
          >
            {task.taskSummary}
          </p>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      {/* ソース */}
      <td className="px-2 py-2.5 text-center">
        <span className="inline-flex items-center gap-1">
          {SOURCE_ICONS[task.source]}
          <span className="text-muted-foreground">{SOURCE_LABELS[task.source]}</span>
        </span>
      </td>

      {/* カテゴリ */}
      <td className="px-2 py-2.5 text-center">
        {task.categories.length > 0 ? (
          <span className="inline-flex flex-wrap gap-0.5">
            {task.categories.map((cat) => (
              <span
                key={cat}
                className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      {/* 割り振り */}
      <td className="px-2 py-2.5 text-muted-foreground">
        {task.assignees || <span className="text-muted-foreground/40">—</span>}
      </td>

      {/* ステータス */}
      <td className="px-2 py-2.5 text-center">
        <span
          className={cn(
            "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
            RESPONSE_STATUS_BADGE_COLORS[task.responseStatus],
          )}
        >
          {RESPONSE_STATUS_LABELS[task.responseStatus]}
        </span>
      </td>

      {/* 期限 */}
      <td className="px-2 py-2.5 whitespace-nowrap">
        {task.deadline ? (
          <DeadlineBadge deadline={task.deadline} />
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      {/* ワークフローステップ（給与カテゴリのみ操作可能） */}
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

function DeadlineBadge({ deadline }: { deadline: string }) {
  const isOverdue = new Date(deadline) < new Date();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        isOverdue ? "text-red-600 font-medium" : "text-muted-foreground",
      )}
    >
      <Clock size={11} />
      {formatDateJST(deadline)}
    </span>
  );
}
