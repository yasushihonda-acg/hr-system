"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { ChatMessageSummary, WorkflowSteps } from "@/lib/types";
import { buildMessageSearchUrl, formatDateJST } from "@/lib/utils";
import { DEFAULT_STEPS, nextStepStatus, STEP_CONFIG } from "@/lib/workflow-steps";
import { updateResponseStatusAction, updateWorkflowAction } from "./[id]/actions";

type ResponseStatus = NonNullable<ChatMessageSummary["intent"]>["responseStatus"];

const RS_CYCLE: ResponseStatus[] = ["unresponded", "in_progress", "responded", "not_required"];

const RS_CONFIG: Record<ResponseStatus, { label: string; cls: string }> = {
  unresponded: { label: "未対応", cls: "bg-rose-50 text-rose-700 border border-rose-200" },
  in_progress: { label: "対応中", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  responded: { label: "対応済", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  not_required: { label: "不要", cls: "bg-muted text-muted-foreground border border-border" },
};

function nextInCycle<T>(arr: T[], current: T): T {
  const idx = arr.indexOf(current);
  return arr[(idx + 1) % arr.length] ?? (arr[0] as T);
}

const formatDate = formatDateJST;

interface RowState {
  responseStatus: ResponseStatus;
  taskSummary: string;
  assignees: string;
  notes: string;
  workflowSteps: WorkflowSteps;
}

function TableRow({ msg, rowNo }: { msg: ChatMessageSummary; rowNo: number }) {
  const intent = msg.intent;
  const [isPending, startTransition] = useTransition();

  const [state, setState] = useState<RowState>({
    responseStatus: intent?.responseStatus ?? "unresponded",
    taskSummary: intent?.taskSummary ?? "",
    assignees: intent?.assignees ?? "",
    notes: intent?.notes ?? "",
    workflowSteps: intent?.workflowSteps ?? { ...DEFAULT_STEPS },
  });
  const [savedText, setSavedText] = useState({
    taskSummary: intent?.taskSummary ?? "",
    assignees: intent?.assignees ?? "",
    notes: intent?.notes ?? "",
  });

  const handleResponseStatus = () => {
    const next = nextInCycle(RS_CYCLE, state.responseStatus);
    setState((s) => ({ ...s, responseStatus: next }));
    startTransition(async () => {
      await updateResponseStatusAction(msg.id, next);
    });
  };

  const handleStep = (key: keyof WorkflowSteps) => {
    const next = nextStepStatus(state.workflowSteps[key]);
    const newSteps = { ...state.workflowSteps, [key]: next };
    setState((s) => ({ ...s, workflowSteps: newSteps }));
    startTransition(async () => {
      await updateWorkflowAction(msg.id, { workflowSteps: newSteps });
    });
  };

  const handleTextBlur = (field: "taskSummary" | "assignees" | "notes") => {
    const current = state[field];
    if (current === savedText[field]) return;
    setSavedText((s) => ({ ...s, [field]: current }));
    startTransition(async () => {
      await updateWorkflowAction(msg.id, { [field]: current || null });
    });
  };

  const chatUrl = buildMessageSearchUrl(msg.content);

  return (
    <tr
      className={`group border-b border-border/60 transition-colors hover:bg-accent/30 ${isPending ? "opacity-60" : ""}`}
    >
      {/* No */}
      <td className="w-8 px-2 py-2 text-center text-xs tabular-nums text-muted-foreground">
        {rowNo}
      </td>

      {/* 発生日 */}
      <td className="w-16 whitespace-nowrap px-2 py-2 text-xs tabular-nums text-muted-foreground">
        {formatDate(msg.createdAt)}
      </td>

      {/* 記事のコピー */}
      <td className="max-w-[240px] px-2 py-2">
        <div className="flex items-start gap-1">
          <Link
            href={`/chat-messages/${msg.id}`}
            className="line-clamp-2 text-xs text-foreground/80 hover:text-foreground hover:underline"
          >
            {msg.content}
          </Link>
          {chatUrl && (
            <a
              href={chatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 shrink-0 text-muted-foreground/40 hover:text-muted-foreground"
            >
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </td>

      {/* タスク */}
      <td className="min-w-[120px] px-2 py-1">
        <textarea
          rows={2}
          value={state.taskSummary}
          onChange={(e) => setState((s) => ({ ...s, taskSummary: e.target.value }))}
          onBlur={() => handleTextBlur("taskSummary")}
          placeholder="タスク"
          className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-foreground/80 placeholder:text-muted-foreground/40 focus:border-border focus:bg-card focus:outline-none"
        />
      </td>

      {/* 割り振り */}
      <td className="min-w-[80px] px-2 py-2">
        <input
          type="text"
          value={state.assignees}
          onChange={(e) => setState((s) => ({ ...s, assignees: e.target.value }))}
          onBlur={() => handleTextBlur("assignees")}
          placeholder="担当者"
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-foreground/80 placeholder:text-muted-foreground/40 focus:border-border focus:bg-card focus:outline-none"
        />
      </td>

      {/* 対応状況 */}
      <td className="w-16 px-2 py-2 text-center">
        <button
          type="button"
          onClick={handleResponseStatus}
          disabled={isPending}
          className={`cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${RS_CONFIG[state.responseStatus].cls}`}
        >
          {RS_CONFIG[state.responseStatus].label}
        </button>
      </td>

      {/* ❶〜❹ */}
      {(
        [
          "salaryListReflection",
          "noticeExecution",
          "laborLawyerShare",
          "smartHRReflection",
        ] as const
      ).map((key) => (
        <td key={key} className="w-10 px-1 py-2 text-center">
          <button
            type="button"
            onClick={() => handleStep(key)}
            disabled={isPending}
            className={`w-8 cursor-pointer rounded px-1 py-0.5 text-xs transition-opacity hover:opacity-80 ${STEP_CONFIG[state.workflowSteps[key]].cls}`}
          >
            {STEP_CONFIG[state.workflowSteps[key]].label}
          </button>
        </td>
      ))}

      {/* メモ */}
      <td className="min-w-[120px] px-2 py-1">
        <textarea
          rows={2}
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
          onBlur={() => handleTextBlur("notes")}
          placeholder="メモ"
          className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-foreground/80 placeholder:text-muted-foreground/40 focus:border-border focus:bg-card focus:outline-none"
        />
      </td>
    </tr>
  );
}

export function TableView({
  messages,
  offset = 0,
}: {
  messages: ChatMessageSummary[];
  offset?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-border/60 bg-muted/50">
            <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
              No
            </th>
            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
              発生日
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
              記事のコピー
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
              タスク
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
              割り振り
            </th>
            <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
              対応状況
            </th>
            <th
              className="w-10 px-1 py-2 text-center text-xs font-semibold text-muted-foreground"
              title="❶条件通知書SS反映"
            >
              ❶
            </th>
            <th
              className="w-10 px-1 py-2 text-center text-xs font-semibold text-muted-foreground"
              title="❷通知・締結"
            >
              ❷
            </th>
            <th
              className="w-10 px-1 py-2 text-center text-xs font-semibold text-muted-foreground"
              title="❸社労士共有"
            >
              ❸
            </th>
            <th
              className="w-10 px-1 py-2 text-center text-xs font-semibold text-muted-foreground"
              title="❹SmartHR反映"
            >
              ❹
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
              メモ
            </th>
          </tr>
        </thead>
        <tbody>
          {messages.map((msg, i) => (
            <TableRow key={msg.id} msg={msg} rowNo={offset + i + 1} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
