"use client";

import type { ResponseStatus } from "@hr-system/shared";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { WorkflowPanel } from "@/components/workflow-panel";
import {
  CATEGORY_LABELS,
  RESPONSE_STATUS_BADGE_COLORS,
  RESPONSE_STATUS_LABELS,
} from "@/lib/constants";
import type { ChatMessageSummary, WorkflowSteps } from "@/lib/types";
import { cn, formatDateTimeJST } from "@/lib/utils";
import { updateResponseStatusAction, updateWorkflowAction } from "./actions";
import { HandoverForm } from "./handover-form";

interface InboxListProps {
  messages: ChatMessageSummary[];
}

export function InboxList({ messages }: InboxListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">該当するメッセージはありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((msg) => (
        <InboxCard
          key={msg.id}
          message={msg}
          isExpanded={expandedId === msg.id}
          onToggle={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
        />
      ))}
    </div>
  );
}

function InboxCard({
  message,
  isExpanded,
  onToggle,
}: {
  message: ChatMessageSummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const intent = message.intent;
  const responseStatus = (intent?.responseStatus ?? "unresponded") as ResponseStatus;
  const category = intent?.category ?? "other";
  const [currentStatus, setCurrentStatus] = useState<ResponseStatus>(responseStatus);
  const [statusSaving, setStatusSaving] = useState(false);

  async function handleStatusChange(next: ResponseStatus) {
    if (next === currentStatus) return;
    setStatusSaving(true);
    try {
      await updateResponseStatusAction(message.id, next);
      setCurrentStatus(next);
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleWorkflowUpdate(steps: WorkflowSteps) {
    await updateWorkflowAction(message.id, { workflowSteps: steps });
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-white shadow-sm transition-all",
        currentStatus === "unresponded" && "border-red-200/60",
        currentStatus === "in_progress" && "border-yellow-200/60",
        currentStatus === "responded" && "border-green-200/60",
        currentStatus === "not_required" && "border-border",
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 flex-shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          {/* Top: sender + category + status */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-foreground">{message.senderName}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              {CATEGORY_LABELS[category] ?? category}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                RESPONSE_STATUS_BADGE_COLORS[currentStatus],
              )}
            >
              {RESPONSE_STATUS_LABELS[currentStatus]}
            </span>
            <span className="ml-auto text-muted-foreground">
              {formatDateTimeJST(message.createdAt)}
            </span>
          </div>

          {/* Content preview */}
          <p className="mt-1 text-sm text-foreground line-clamp-2">{message.content}</p>

          {/* Workflow progress bar (compact) */}
          {intent?.workflowSteps && !isExpanded && (
            <div className="mt-2 max-w-48">
              <WorkflowPanel steps={intent.workflowSteps} onUpdate={handleWorkflowUpdate} compact />
            </div>
          )}
        </div>

        <Link
          href={`/chat-messages/${message.id}`}
          className="flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="詳細を開く"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="border-t border-border/60 bg-muted/30 px-4 py-4 animate-fade-up">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Status control */}
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">対応状況</p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  ["unresponded", "in_progress", "responded", "not_required"] as ResponseStatus[]
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={statusSaving}
                    onClick={() => handleStatusChange(s)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                      RESPONSE_STATUS_BADGE_COLORS[s],
                      s === currentStatus
                        ? "ring-2 ring-current/30 ring-offset-1"
                        : "opacity-50 hover:opacity-80",
                    )}
                  >
                    {RESPONSE_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Workflow panel */}
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">ワークフロー</p>
              <WorkflowPanel
                steps={intent?.workflowSteps ?? null}
                onUpdate={handleWorkflowUpdate}
              />
            </div>

            {/* Handover notes */}
            <div>
              <HandoverForm
                chatMessageId={message.id}
                taskSummary={intent?.taskSummary ?? null}
                assignees={intent?.assignees ?? null}
                deadline={intent?.deadline ?? null}
                notes={intent?.notes ?? null}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
