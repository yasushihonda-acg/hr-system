"use client";

import type { LineMessageSummary } from "@/lib/types";
import { formatDateTimeJST } from "@/lib/utils";

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

const formatDateTime = formatDateTimeJST;

export function LineMessageCard({ msg }: { msg: LineMessageSummary }) {
  const senderDisplay = msg.senderName || "不明";
  const avatarBg = getAvatarColor(senderDisplay);
  const ini = getInitials(senderDisplay);

  return (
    <div className="group block w-full text-left">
      <div className="relative border-l-4 border-l-[#06C755] rounded-r-xl bg-white px-5 py-4 shadow ring-1 ring-slate-200/80">
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
              </div>
              <time className="shrink-0 font-mono text-xs text-slate-400 tabular-nums">
                {formatDateTime(msg.createdAt)}
              </time>
            </div>

            {/* Content */}
            {msg.content && (
              <p className="mb-2.5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                {msg.content}
              </p>
            )}

            {/* Media (image) */}
            {msg.contentUrl && msg.lineMessageType === "image" && (
              <a
                href={msg.contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2.5 block"
              >
                <img
                  src={msg.contentUrl}
                  alt="LINE 画像"
                  className="max-h-64 rounded-lg border border-slate-200 object-contain"
                  loading="lazy"
                />
              </a>
            )}

            {/* Media (other) */}
            {msg.contentUrl && msg.lineMessageType !== "image" && (
              <a
                href={msg.contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2.5 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                {msg.lineMessageType === "video"
                  ? "動画"
                  : msg.lineMessageType === "audio"
                    ? "音声"
                    : "ファイル"}
                を開く
              </a>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-[#06C755]/10 text-[#06C755] ring-1 ring-inset ring-[#06C755]/20">
                LINE
              </span>
              {msg.groupName && <span className="text-xs text-slate-400">{msg.groupName}</span>}
              {msg.lineMessageType !== "text" && (
                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200">
                  {msg.lineMessageType}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
