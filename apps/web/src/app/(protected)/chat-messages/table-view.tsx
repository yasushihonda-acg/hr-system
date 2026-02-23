"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { ChatMessageSummary, WorkflowStepStatus, WorkflowSteps } from "@/lib/types";
import { buildMessageSearchUrl } from "@/lib/utils";
import { updateResponseStatusAction, updateWorkflowAction } from "./[id]/actions";

type ResponseStatus = NonNullable<ChatMessageSummary["intent"]>["responseStatus"];

const RS_CYCLE: ResponseStatus[] = ["unresponded", "in_progress", "responded", "not_required"];
const STEP_CYCLE: WorkflowStepStatus[] = ["undetermined", "completed", "not_required"];

const DEFAULT_STEPS: WorkflowSteps = {
  salaryListReflection: "undetermined",
  noticeExecution: "undetermined",
  laborLawyerShare: "undetermined",
  smartHRReflection: "undetermined",
};

const RS_CONFIG: Record<ResponseStatus, { label: string; cls: string }> = {
  unresponded: { label: "未対応", cls: "bg-rose-50 text-rose-700 border border-rose-200" },
  in_progress: { label: "対応中", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  responded: { label: "対応済", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  not_required: { label: "不要", cls: "bg-slate-100 text-slate-500 border border-slate-200" },
};

const STEP_CONFIG: Record<WorkflowStepStatus, { label: string; cls: string }> = {
  undetermined: { label: "ー", cls: "text-slate-400 bg-slate-50 border border-slate-200" },
  completed: {
    label: "✓",
    cls: "text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold",
  },
  not_required: {
    label: "✗",
    cls: "text-slate-400 bg-slate-100 border border-slate-200 line-through",
  },
};

function nextInCycle<T>(arr: T[], current: T): T {
  const idx = arr.indexOf(current);
  return arr[(idx + 1) % arr.length] ?? arr[0]!;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
  });
}

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
    const next = nextInCycle(STEP_CYCLE, state.workflowSteps[key]);
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
      className={`group border-b border-slate-100 transition-colors hover:bg-blue-50/30 ${isPending ? "opacity-60" : ""}`}
    >
      {/* No */}
      <td className="w-8 px-2 py-2 text-center text-xs tabular-nums text-slate-400">{rowNo}</td>

      {/* 発生日 */}
      <td className="w-16 whitespace-nowrap px-2 py-2 text-xs tabular-nums text-slate-500">
        {formatDate(msg.createdAt)}
      </td>

      {/* 記事のコピー */}
      <td className="max-w-[240px] px-2 py-2">
        <div className="flex items-start gap-1">
          <Link
            href={`/chat-messages/${msg.id}`}
            className="line-clamp-2 text-xs text-slate-700 hover:text-blue-600 hover:underline"
          >
            {msg.content}
          </Link>
          {chatUrl && (
            <a
              href={chatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 shrink-0 text-slate-300 hover:text-slate-500"
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
          className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none"
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
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none"
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
          className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none"
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
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500">No</th>
            <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-slate-500">
              発生日
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500">
              記事のコピー
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500">タスク</th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500">割り振り</th>
            <th className="whitespace-nowrap px-2 py-2 text-center text-xs font-semibold text-slate-500">
              対応状況
            </th>
            <th
              className="w-10 px-1 py-2 text-center text-xs font-semibold text-slate-500"
              title="❶条件通知書SS反映"
            >
              ❶
            </th>
            <th
              className="w-10 px-1 py-2 text-center text-xs font-semibold text-slate-500"
              title="❷通知・締結"
            >
              ❷
            </th>
            <th
              className="w-10 px-1 py-2 text-center text-xs font-semibold text-slate-500"
              title="❸社労士共有"
            >
              ❸
            </th>
            <th
              className="w-10 px-1 py-2 text-center text-xs font-semibold text-slate-500"
              title="❹SmartHR反映"
            >
              ❹
            </th>
            <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500">メモ</th>
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
