import {
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  MessageSquare,
  Paperclip,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AttachmentList } from "@/components/chat/attachment-list";
import { ContentWithMentions } from "@/components/chat/rich-content";
import { ChatSyncButton } from "@/components/chat/sync-button";
import { getChatMessages, getStatsSpaces } from "@/lib/api";
import type { ChatMessageSummary } from "@/lib/types";

interface Props {
  searchParams: Promise<{
    category?: string;
    messageType?: "MESSAGE" | "THREAD_REPLY";
    spaceId?: string;
    lowConfidence?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 30;

const CATEGORY_CONFIG: Record<string, { label: string; accent: string; pill: string }> = {
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

const SPACE_NAMES: Record<string, string> = {
  "AAAA-qf5jX0": "人事関連(全社共通)",
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

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
    </Link>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      {children}
    </div>
  );
}

function MessageCard({ msg }: { msg: ChatMessageSummary }) {
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
    <Link href={`/chat-messages/${msg.id}`} className="block group">
      <div
        className={`relative border-l-4 ${accent} rounded-r-xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200/80 transition-all duration-150 group-hover:shadow-md group-hover:ring-slate-300 ${
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
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg} ${
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
                  className={`truncate text-sm font-semibold ${senderDisplay === "不明" ? "italic text-slate-400" : "text-slate-800"}`}
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
              <time className="shrink-0 font-mono text-xs text-slate-400 tabular-nums">
                {formatDateTime(msg.createdAt)}
              </time>
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

export default async function ChatMessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const isLowConfidence = params.lowConfidence === "1";

  const [{ data: messages, pagination }, spacesData] = await Promise.all([
    getChatMessages({
      category: params.category,
      messageType: params.messageType,
      spaceId: params.spaceId,
      maxConfidence: isLowConfidence ? 0.7 : undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    getStatsSpaces(),
  ]);

  function buildUrl(overrides: {
    category?: string;
    messageType?: string;
    spaceId?: string;
    lowConfidence?: string;
    page?: string;
  }) {
    const sp = new URLSearchParams();
    const category = "category" in overrides ? overrides.category : params.category;
    const messageType = "messageType" in overrides ? overrides.messageType : params.messageType;
    const spaceId = "spaceId" in overrides ? overrides.spaceId : params.spaceId;
    const lowConfidence =
      "lowConfidence" in overrides ? overrides.lowConfidence : params.lowConfidence;
    const p = overrides.page;
    if (category) sp.set("category", category);
    if (messageType) sp.set("messageType", messageType);
    if (spaceId) sp.set("spaceId", spaceId);
    if (lowConfidence) sp.set("lowConfidence", lowConfidence);
    if (p && p !== "1") sp.set("page", p);
    const qs = sp.toString();
    return `/chat-messages${qs ? `?${qs}` : ""}`;
  }

  const totalCount = offset + messages.length;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">チャット分析</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {pagination.hasMore ? `${totalCount}件以上表示中` : `全${totalCount}件`}
          </p>
        </div>
        <ChatSyncButton />
      </div>

      {/* Filter panel */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="space-y-2.5">
          {spacesData.spaces.length > 0 && (
            <FilterRow label="スペース">
              <FilterPill
                href={buildUrl({ spaceId: undefined, page: "1" })}
                label="すべて"
                active={!params.spaceId}
              />
              {spacesData.spaces.map(({ spaceId, count }) => (
                <FilterPill
                  key={spaceId}
                  href={buildUrl({ spaceId, page: "1" })}
                  label={`${SPACE_NAMES[spaceId] ?? spaceId} (${count})`}
                  active={params.spaceId === spaceId}
                />
              ))}
            </FilterRow>
          )}
          <FilterRow label="カテゴリ">
            <FilterPill
              href={buildUrl({ category: undefined, page: "1" })}
              label="すべて"
              active={!params.category}
            />
            {Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => (
              <FilterPill
                key={value}
                href={buildUrl({ category: value, page: "1" })}
                label={cfg.label}
                active={params.category === value}
              />
            ))}
          </FilterRow>
          <FilterRow label="種別">
            <FilterPill
              href={buildUrl({ messageType: undefined, page: "1" })}
              label="全投稿"
              active={!params.messageType}
            />
            <FilterPill
              href={buildUrl({ messageType: "MESSAGE", page: "1" })}
              label="通常投稿"
              active={params.messageType === "MESSAGE"}
            />
            <FilterPill
              href={buildUrl({ messageType: "THREAD_REPLY", page: "1" })}
              label="スレッド返信"
              active={params.messageType === "THREAD_REPLY"}
            />
          </FilterRow>
          <FilterRow label="信頼度">
            <FilterPill
              href={buildUrl({ lowConfidence: undefined, page: "1" })}
              label="すべて"
              active={!isLowConfidence}
            />
            <FilterPill
              href={buildUrl({ lowConfidence: "1", page: "1" })}
              label="⚠ 要確認 (< 70%)"
              active={isLowConfidence}
            />
          </FilterRow>
        </div>
      </div>

      {/* Message feed */}
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <MessageSquare className="mb-3 text-slate-300" size={36} />
          <p className="text-sm font-medium text-slate-500">メッセージがありません</p>
          <p className="mt-1 text-xs text-slate-400">フィルタ条件を変えてお試しください</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageCard key={msg.id} msg={msg} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <Link
          href={page > 1 ? buildUrl({ page: String(page - 1) }) : "#"}
          aria-disabled={page <= 1}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            page <= 1 ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ChevronLeft size={16} />
          前へ
        </Link>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-700">
          ページ {page}
        </span>
        <Link
          href={pagination.hasMore ? buildUrl({ page: String(page + 1) }) : "#"}
          aria-disabled={!pagination.hasMore}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            !pagination.hasMore
              ? "pointer-events-none text-slate-300"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          次へ
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
