import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ChatSyncButton } from "@/components/chat/sync-button";
import { getChatMessages, getStatsSpaces } from "@/lib/api";
import { CATEGORY_CONFIG } from "./message-card";
import { ViewContainer } from "./view-container";

interface Props {
  searchParams: Promise<{
    category?: string;
    messageType?: "MESSAGE" | "THREAD_REPLY";
    spaceId?: string;
    lowConfidence?: string;
    page?: string;
    view?: string;
  }>;
}

const PAGE_SIZE = 30;

const SPACE_NAMES: Record<string, string> = {
  "AAAA-qf5jX0": "人事関連(全社共通)",
};

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

export default async function ChatMessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const isLowConfidence = params.lowConfidence === "1";
  const initialView = params.view === "table" ? ("table" as const) : ("card" as const);

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
    view?: string;
  }) {
    const sp = new URLSearchParams();
    const category = "category" in overrides ? overrides.category : params.category;
    const messageType = "messageType" in overrides ? overrides.messageType : params.messageType;
    const spaceId = "spaceId" in overrides ? overrides.spaceId : params.spaceId;
    const lowConfidence =
      "lowConfidence" in overrides ? overrides.lowConfidence : params.lowConfidence;
    const view = "view" in overrides ? overrides.view : params.view;
    const p = overrides.page;
    if (category) sp.set("category", category);
    if (messageType) sp.set("messageType", messageType);
    if (spaceId) sp.set("spaceId", spaceId);
    if (lowConfidence) sp.set("lowConfidence", lowConfidence);
    if (view && view !== "card") sp.set("view", view);
    if (p && p !== "1") sp.set("page", p);
    const qs = sp.toString();
    return `/chat-messages${qs ? `?${qs}` : ""}`;
  }

  const totalCount = offset + messages.length;

  return (
    <div className="-mx-4 -mt-4 min-h-screen bg-slate-50/80 px-4 pt-4">
      <div className="mx-auto max-w-4xl space-y-5">
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
        <Suspense fallback={null}>
          <ViewContainer messages={messages} offset={offset} initialView={initialView} />
        </Suspense>

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
    </div>
  );
}
