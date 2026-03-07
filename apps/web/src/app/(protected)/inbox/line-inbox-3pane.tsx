"use client";

import { Image as ImageIcon, MessageSquare, X } from "lucide-react";
import { ResponseStatusButtons } from "@/components/response-status-buttons";
import { RESPONSE_STATUS_DOT_COLORS } from "@/lib/constants";
import type { LineMessageDetail, LineMessageSummary } from "@/lib/types";
import { cn, formatDateTimeJST } from "@/lib/utils";
import { updateLineResponseStatusAction } from "./actions";
import { useSelectMessage } from "./use-select-message";

interface LineInbox3PaneProps {
  messages: LineMessageSummary[];
  selectedMessage: LineMessageDetail | null;
  selectedId: string | null;
}

export function LineInbox3Pane({ messages, selectedMessage, selectedId }: LineInbox3PaneProps) {
  const selectMessage = useSelectMessage();

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
          const responseStatus = msg.responseStatus;
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
                <span
                  className={cn(
                    "h-2 w-2 flex-shrink-0 rounded-full",
                    RESPONSE_STATUS_DOT_COLORS[responseStatus],
                  )}
                />
                <span className="truncate text-xs font-medium">{msg.senderName}</span>
                {msg.groupName && (
                  <span className="truncate text-[10px] text-muted-foreground">
                    @ {msg.groupName}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {formatDateTimeJST(msg.createdAt)}
                </span>
              </div>

              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {msg.lineMessageType === "image" ? (
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon size={12} />
                    画像
                  </span>
                ) : (
                  msg.content
                )}
              </p>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                  LINE
                </span>
                {msg.lineMessageType !== "text" && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {msg.lineMessageType}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 中央ペイン: 詳細 */}
      {selectedMessage ? (
        <LineDetailPane message={selectedMessage} onClose={() => selectMessage(null)} />
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

function LineDetailPane({ message, onClose }: { message: LineMessageDetail; onClose: () => void }) {
  const responseStatus = message.responseStatus;

  return (
    <div className="flex flex-1 overflow-hidden">
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
            {message.groupName && (
              <span className="text-xs text-muted-foreground">@ {message.groupName}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDateTimeJST(message.createdAt)}
            </span>
          </div>
        </div>

        {/* メッセージ本文 */}
        <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
          {message.lineMessageType === "image" && message.contentUrl ? (
            <img
              src={message.contentUrl}
              alt="LINE画像メッセージ"
              className="max-w-full rounded-lg"
            />
          ) : (
            message.content
          )}
        </div>

        {/* 対応ステータス変更 */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">対応状況</p>
          <ResponseStatusButtons
            currentStatus={responseStatus}
            onChangeStatus={(s) => updateLineResponseStatusAction(message.id, s)}
          />
        </div>

        {/* メタ情報 */}
        <div className="mt-6 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <h3 className="text-xs font-bold text-muted-foreground">メッセージ情報</h3>
          <InfoRow label="グループ" value={message.groupName ?? "不明"} />
          <InfoRow label="送信者" value={message.senderName} />
          <InfoRow label="タイプ" value={message.lineMessageType} />
          {message.responseStatusUpdatedBy && (
            <InfoRow
              label="最終更新"
              value={`${message.responseStatusUpdatedBy} (${message.responseStatusUpdatedAt ? formatDateTimeJST(message.responseStatusUpdatedAt) : ""})`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- 情報行 ---

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
