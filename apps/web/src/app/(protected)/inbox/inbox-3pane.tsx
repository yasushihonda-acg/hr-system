"use client";

import { ExternalLink, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { WorkflowPanel } from "@/components/workflow-panel";
import type {
  ChatMessageDetail,
  ChatMessageSummary,
  IntentDetail,
  WorkflowSteps,
} from "@/lib/types";
import { cn, formatDateTimeJST } from "@/lib/utils";
import { updateResponseStatusAction, updateWorkflowAction } from "./actions";

type ResponseStatus = "unresponded" | "in_progress" | "responded" | "not_required";

const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  unresponded: "未対応",
  in_progress: "対応中",
  responded: "対応済",
  not_required: "対応不要",
};

const RESPONSE_STATUS_COLORS: Record<ResponseStatus, string> = {
  unresponded: "bg-red-500",
  in_progress: "bg-yellow-500",
  responded: "bg-green-500",
  not_required: "bg-gray-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  salary: "給与・社保",
  retirement: "退職・休職",
  hiring: "入社・採用",
  contract: "契約変更",
  transfer: "施設・異動",
  foreigner: "外国人・ビザ",
  training: "研修・監査",
  health_check: "健康診断",
  attendance: "勤怠・休暇",
  other: "その他",
};

interface Inbox3PaneProps {
  messages: ChatMessageSummary[];
  selectedMessage: ChatMessageDetail | null;
  selectedId: string | null;
}

export function Inbox3Pane({ messages, selectedMessage, selectedId }: Inbox3PaneProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectMessage = useCallback(
    (id: string | null) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (id) {
        sp.set("id", id);
      } else {
        sp.delete("id");
      }
      router.replace(`/inbox?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">該当するメッセージはありません</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 左ペイン: メッセージ一覧 */}
      <div
        className={cn(
          "flex-shrink-0 overflow-y-auto border-r border-border/60 bg-white",
          "w-full md:w-[320px]",
          selectedId && "hidden md:block",
        )}
      >
        {messages.map((msg) => {
          const intent = msg.intent;
          const responseStatus = (intent?.responseStatus ?? "unresponded") as ResponseStatus;
          const category = intent?.category ?? "other";
          const isSelected = msg.id === selectedId;

          return (
            <button
              key={msg.id}
              type="button"
              onClick={() => selectMessage(msg.id)}
              className={cn(
                "w-full border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                isSelected && "bg-accent",
              )}
            >
              <div className="flex items-center gap-2">
                {/* ステータスドット */}
                <span
                  className={cn(
                    "h-2 w-2 flex-shrink-0 rounded-full",
                    RESPONSE_STATUS_COLORS[responseStatus],
                  )}
                />
                <span className="truncate text-xs font-medium">{msg.senderName}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {formatDateTimeJST(msg.createdAt)}
                </span>
              </div>

              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{msg.content}</p>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {CATEGORY_LABELS[category] ?? category}
                </span>
                {intent?.confidenceScore != null && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {(intent.confidenceScore * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 中央+右ペイン: 詳細 */}
      {selectedMessage ? (
        <DetailPane message={selectedMessage} onClose={() => selectMessage(null)} />
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">メッセージを選択してください</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 詳細ペイン ---

function DetailPane({ message, onClose }: { message: ChatMessageDetail; onClose: () => void }) {
  const intent = message.intent as IntentDetail | null;
  const responseStatus = (intent?.responseStatus ?? "unresponded") as ResponseStatus;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 中央ペイン: メッセージ詳細 */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-accent md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-base font-bold">{message.senderName}</h2>
            <span className="text-xs text-muted-foreground">
              {formatDateTimeJST(message.createdAt)}
            </span>
          </div>
          <Link
            href={`/chat-messages/${message.id}`}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
            title="詳細ページ"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>

        {/* メッセージ本文 */}
        <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">{message.content}</div>

        {/* 対応ステータス変更 */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">対応状況</p>
          <StatusButtons chatMessageId={message.id} currentStatus={responseStatus} />
        </div>

        {/* ワークフロー */}
        {intent && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">ワークフロー</p>
            <WorkflowPanelWrapper chatMessageId={message.id} steps={intent.workflowSteps ?? null} />
          </div>
        )}

        {/* スレッド */}
        {message.threadMessages.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              スレッド ({message.threadMessages.length}件)
            </p>
            <div className="space-y-2">
              {message.threadMessages.map((tm) => (
                <div key={tm.id} className="rounded-lg border border-border/60 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tm.senderName}</span>
                    <span className="text-muted-foreground">{formatDateTimeJST(tm.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{tm.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 右ペイン: AI分析 (lg以上で表示) */}
      {intent && (
        <div className="hidden w-[300px] flex-shrink-0 overflow-y-auto border-l border-border/60 bg-muted/20 p-4 lg:block">
          <AiAnalysisPanel intent={intent} />
        </div>
      )}
    </div>
  );
}

// --- AI分析パネル ---

function AiAnalysisPanel({ intent }: { intent: IntentDetail }) {
  const category = intent.category;
  const confidence = intent.confidenceScore;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold">AI 判定</h3>

      <div className="rounded-lg border border-border/60 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">カテゴリ</span>
          <span className="rounded-full bg-[var(--gradient-from)]/10 px-2 py-0.5 text-xs font-medium text-[var(--gradient-from)]">
            {CATEGORY_LABELS[category] ?? category}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">信頼度</span>
          <span className="text-sm font-bold tabular-nums">
            {confidence != null ? `${(confidence * 100).toFixed(0)}%` : "—"}
          </span>
        </div>
        {confidence != null && (
          <div className="mt-2 h-1.5 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--gradient-from)] transition-[width] duration-300"
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border/60 bg-white p-3">
        <span className="text-xs text-muted-foreground">分類方法</span>
        <p className="mt-1 text-xs font-medium">
          {intent.classificationMethod === "ai"
            ? "AI (Gemini)"
            : intent.classificationMethod === "regex"
              ? "正規表現"
              : "手動"}
        </p>
      </div>

      {intent.reasoning && (
        <div className="rounded-lg border border-border/60 bg-white p-3">
          <span className="text-xs text-muted-foreground">推論</span>
          <p className="mt-1 text-xs leading-relaxed">{intent.reasoning}</p>
        </div>
      )}

      {intent.isManualOverride && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <span className="text-xs font-medium text-amber-800">手動修正済</span>
          {intent.originalCategory && (
            <p className="mt-1 text-xs text-amber-700">
              元: {CATEGORY_LABELS[intent.originalCategory] ?? intent.originalCategory}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// --- ステータス変更ボタン ---

function StatusButtons({
  chatMessageId,
  currentStatus,
}: {
  chatMessageId: string;
  currentStatus: ResponseStatus;
}) {
  async function handleChange(status: ResponseStatus) {
    if (status === currentStatus) return;
    await updateResponseStatusAction(chatMessageId, status);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {(["unresponded", "in_progress", "responded", "not_required"] as ResponseStatus[]).map(
        (s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleChange(s)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              s === currentStatus
                ? "border-current bg-current/10 ring-2 ring-current/20"
                : "border-border text-muted-foreground opacity-60 hover:opacity-100",
              s === "unresponded" && "text-red-600",
              s === "in_progress" && "text-yellow-600",
              s === "responded" && "text-green-600",
              s === "not_required" && "text-gray-500",
            )}
          >
            {RESPONSE_STATUS_LABELS[s]}
          </button>
        ),
      )}
    </div>
  );
}

// --- ワークフローラッパー ---

function WorkflowPanelWrapper({
  chatMessageId,
  steps,
}: {
  chatMessageId: string;
  steps: WorkflowSteps | null;
}) {
  async function handleUpdate(newSteps: WorkflowSteps) {
    await updateWorkflowAction(chatMessageId, { workflowSteps: newSteps });
  }

  return <WorkflowPanel steps={steps} onUpdate={handleUpdate} />;
}
