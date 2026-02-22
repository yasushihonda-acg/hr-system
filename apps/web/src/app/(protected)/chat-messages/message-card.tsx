"use client";

import { CornerDownRight, ExternalLink, Paperclip, Pencil } from "lucide-react";
import Link from "next/link";
import { AttachmentList } from "@/components/chat/attachment-list";
import { ContentWithMentions } from "@/components/chat/rich-content";
import type { ChatMessageSummary } from "@/lib/types";

export const CATEGORY_CONFIG: Record<string, { label: string; accent: string; pill: string }> = {
  salary: {
    label: "給与・社保",
    accent: "border-l-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  },
  retirement: {
    label: "退職・休職",
    accent: "border-l-red-500",
    pill: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  },
  hiring: {
    label: "入社・採用",
    accent: "border-l-blue-500",
    pill: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  },
  contract: {
    label: "契約変更",
    accent: "border-l-amber-500",
    pill: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  },
  transfer: {
    label: "施設・異動",
    accent: "border-l-purple-500",
    pill: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200",
  },
  foreigner: {
    label: "外国人・ビザ",
    accent: "border-l-orange-500",
    pill: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
  },
  training: {
    label: "研修・監査",
    accent: "border-l-indigo-500",
    pill: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
  },
  health_check: {
    label: "健康診断",
    accent: "border-l-pink-500",
    pill: "bg-pink-50 text-pink-700 ring-1 ring-inset ring-pink-200",
  },
  attendance: {
    label: "勤怠・休暇",
    accent: "border-l-teal-500",
    pill: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200",
  },
  other: {
    label: "その他",
    accent: "border-l-slate-300",
    pill: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  unresponded: { label: "未対応", cls: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200" },
  in_progress: {
    label: "対応中",
    cls: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  },
  responded: {
    label: "対応済",
    cls: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  },
  not_required: {
    label: "対応不要",
    cls: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200",
  },
};

const METHOD_CONFIG: Record<string, { label: string; cls: string }> = {
  ai: { label: "AI", cls: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200" },
  regex: { label: "RegEx", cls: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200" },
  manual: { label: "手動", cls: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200" },
};

const AVATAR_PALETTE = [
  "bg-rose-400",
  "bg-orange-400",
  "bg-amber-500",
  "bg-lime-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-violet-400",
  "bg-pink-400",
];

function getAvatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length] ?? "bg-slate-500";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return name.slice(0, 2);
}

/** googleMessageId ("spaces/{spaceId}/messages/{messageId}") から Google Chat URL を生成 */
function buildChatUrl(googleMessageId: string): string {
  const match = googleMessageId.match(/^spaces\/([^/]+)\/messages\/([^/]+)$/);
  if (!match) return "";
  return `https://chat.google.com/room/${match[1]}/${match[2]}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConfidenceMeter({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const bar = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-rose-500";
  const txt = pct >= 80 ? "text-emerald-700" : pct >= 60 ? "text-amber-600" : "text-rose-600";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono text-xs tabular-nums ${txt}`}>{pct}%</span>
    </div>
  );
}

export function MessageCard({ msg }: { msg: ChatMessageSummary }) {
  const catCfg = msg.intent
    ? (CATEGORY_CONFIG[msg.intent.category] ?? CATEGORY_CONFIG.other)
    : null;
  const accent = catCfg?.accent ?? "border-l-slate-200";
  const senderDisplay = msg.senderName || "不明";
  const avatarBg = getAvatarColor(senderDisplay);
  const ini = getInitials(senderDisplay);
  const isReply = msg.messageType === "THREAD_REPLY";
  const statCfg = msg.intent ? (STATUS_CONFIG[msg.intent.responseStatus] ?? null) : null;
  const methCfg = msg.intent ? (METHOD_CONFIG[msg.intent.classificationMethod] ?? null) : null;

  return (
    <Link href={`/chat-messages/${msg.id}`} className="group block">
      <div
        className={`relative border-l-4 ${accent} rounded-r-xl bg-white px-5 py-4 shadow ring-1 ring-slate-200/80 transition-all duration-150 group-hover:shadow-lg group-hover:ring-slate-300 ${
          isReply ? "ml-8" : ""
        }`}
      >
        {isReply && (
          <div className="absolute -left-[30px] top-4 text-slate-400">
            <CornerDownRight size={15} />
          </div>
        )}

        <div className="flex gap-3">
          {/* Avatar */}
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg} ${
              senderDisplay === "不明" ? "opacity-50" : ""
            }`}
          >
            {ini}
          </div>

          {/* Body */}
          <div className="min-w-0 flex-1">
            {/* Header row */}
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`truncate text-sm font-bold ${senderDisplay === "不明" ? "italic text-slate-400" : "text-slate-800"}`}
                >
                  {senderDisplay}
                </span>
                {msg.isEdited && (
                  <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-slate-400">
                    <Pencil size={9} />
                    編集済
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <time className="font-mono text-xs text-slate-400 tabular-nums">
                  {formatDateTime(msg.createdAt)}
                </time>
                {buildChatUrl(msg.googleMessageId) && (
                  <a
                    href={buildChatUrl(msg.googleMessageId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-400 transition-colors hover:text-slate-600"
                    title="Google Chat で開く"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>

            {/* Content */}
            <ContentWithMentions
              content={msg.content}
              formattedContent={msg.formattedContent}
              mentionedUsers={msg.mentionedUsers}
              className="mb-2.5 line-clamp-2 text-sm leading-relaxed text-slate-700"
            />

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-2">
              {catCfg ? (
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${catCfg.pill}`}
                >
                  {catCfg.label}
                </span>
              ) : (
                <span className="text-xs text-slate-400">未分類</span>
              )}
              {methCfg && (
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${methCfg.cls}`}
                >
                  {methCfg.label}
                </span>
              )}
              {msg.intent && <ConfidenceMeter score={msg.intent.confidenceScore} />}
              {statCfg && (
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statCfg.cls}`}
                >
                  {statCfg.label}
                </span>
              )}
              {msg.intent?.isManualOverride && (
                <span className="text-xs font-medium text-amber-500">修正済</span>
              )}
            </div>

            {/* Attachments */}
            {msg.attachments.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-400">
                  <Paperclip size={11} />
                  添付ファイル ({msg.attachments.length}件)
                </p>
                <AttachmentList attachments={msg.attachments} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
