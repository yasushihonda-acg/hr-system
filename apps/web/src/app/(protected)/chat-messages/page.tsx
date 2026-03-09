import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ChatSyncButton } from "@/components/chat/sync-button";
import { requireAccess } from "@/lib/access-control";
import {
  getChatMessages,
  getChatSpaces,
  getLineMessageStats,
  getLineMessages,
  getStatsSpaces,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { LineViewContainer } from "./line-view-container";
import { CATEGORY_CONFIG } from "./message-card";
import { ViewContainer } from "./view-container";

interface Props {
  searchParams: Promise<{
    source?: string;
    category?: string;
    messageType?: "MESSAGE" | "THREAD_REPLY";
    spaceId?: string;
    groupId?: string;
    lowConfidence?: string;
    page?: string;
    view?: string;
  }>;
}

const PAGE_SIZE = 30;

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        active
          ? "bg-[var(--gradient-from)] text-white"
          : "bg-muted text-muted-foreground hover:bg-accent",
      )}
    >
      {label}
    </Link>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export default async function ChatMessagesPage({ searchParams }: Props) {
  const access = await requireAccess();
  const isAdmin = access.role === "admin";
  const params = await searchParams;
  const source = params.source === "line" ? "line" : "gchat";
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const isLowConfidence = params.lowConfidence === "1";
  const initialView = params.view === "table" ? ("table" as const) : ("card" as const);

  function buildUrl(overrides: {
    source?: string;
    category?: string;
    messageType?: string;
    spaceId?: string;
    groupId?: string;
    lowConfidence?: string;
    page?: string;
    view?: string;
  }) {
    const sp = new URLSearchParams();
    const src = "source" in overrides ? overrides.source : params.source;
    const category = "category" in overrides ? overrides.category : params.category;
    const messageType = "messageType" in overrides ? overrides.messageType : params.messageType;
    const spaceId = "spaceId" in overrides ? overrides.spaceId : params.spaceId;
    const groupId = "groupId" in overrides ? overrides.groupId : params.groupId;
    const lowConfidence =
      "lowConfidence" in overrides ? overrides.lowConfidence : params.lowConfidence;
    const view = "view" in overrides ? overrides.view : params.view;
    const p = overrides.page;
    if (src && src !== "gchat") sp.set("source", src);
    if (category) sp.set("category", category);
    if (messageType) sp.set("messageType", messageType);
    if (spaceId) sp.set("spaceId", spaceId);
    if (groupId) sp.set("groupId", groupId);
    if (lowConfidence) sp.set("lowConfidence", lowConfidence);
    if (view && view !== "card") sp.set("view", view);
    if (p && p !== "1") sp.set("page", p);
    const qs = sp.toString();
    return `/chat-messages${qs ? `?${qs}` : ""}`;
  }

  // Source tabs (shared between both views)
  const sourceTabsHtml = (
    <div className="flex rounded-lg border border-border/60 bg-card p-0.5">
      <Link
        href={buildUrl({
          source: undefined,
          page: "1",
          category: undefined,
          messageType: undefined,
          spaceId: undefined,
          groupId: undefined,
          lowConfidence: undefined,
        })}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          source === "gchat"
            ? "bg-[var(--gradient-from)] text-white"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Google Chat
      </Link>
      <Link
        href={buildUrl({
          source: "line",
          page: "1",
          category: undefined,
          messageType: undefined,
          spaceId: undefined,
          groupId: undefined,
          lowConfidence: undefined,
        })}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          source === "line"
            ? "bg-[#06C755] text-white"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        LINE
      </Link>
    </div>
  );

  if (source === "line") {
    const [{ data: lineMessages, pagination }, statsData] = await Promise.all([
      getLineMessages({ groupId: params.groupId, limit: PAGE_SIZE, offset }),
      getLineMessageStats(),
    ]);

    const totalCount = offset + lineMessages.length;

    return (
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-accent shadow-sm">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">チャット分析</h1>
              <p className="text-xs text-muted-foreground">
                {pagination.hasMore ? `${totalCount}件以上表示中` : `全${totalCount}件`}
              </p>
            </div>
          </div>
          {sourceTabsHtml}
        </div>

        {/* LINE Filter panel */}
        {statsData.groups.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card px-5 py-4">
            <FilterRow label="グループ">
              <FilterPill
                href={buildUrl({ groupId: undefined, page: "1" })}
                label="すべて"
                active={!params.groupId}
              />
              {statsData.groups.map(({ groupId, groupName, count }) => (
                <FilterPill
                  key={groupId}
                  href={buildUrl({ groupId, page: "1" })}
                  label={`${groupName ?? groupId.slice(0, 8)} (${count})`}
                  active={params.groupId === groupId}
                />
              ))}
            </FilterRow>
          </div>
        )}

        {/* LINE Message feed */}
        <Suspense fallback={null}>
          <LineViewContainer messages={lineMessages} />
        </Suspense>

        {/* Pagination */}
        <Pagination page={page} hasMore={pagination.hasMore} buildUrl={buildUrl} />
      </div>
    );
  }

  // Google Chat view (default)
  const [{ data: messages, pagination }, spacesData, spacesConfig] = await Promise.all([
    getChatMessages({
      category: params.category,
      messageType: params.messageType,
      spaceId: params.spaceId,
      maxConfidence: isLowConfidence ? 0.7 : undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    getStatsSpaces(),
    getChatSpaces(),
  ]);

  const spaceNameMap = Object.fromEntries(spacesConfig.data.map((s) => [s.spaceId, s.displayName]));
  const totalCount = offset + messages.length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-accent shadow-sm">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">チャット分析</h1>
            <p className="text-xs text-muted-foreground">
              {pagination.hasMore ? `${totalCount}件以上表示中` : `全${totalCount}件`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sourceTabsHtml}
          {isAdmin && <ChatSyncButton />}
        </div>
      </div>

      {/* Filter panel */}
      <div className="rounded-xl border border-border/60 bg-card px-5 py-4">
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
                  label={`${spaceNameMap[spaceId] ?? spaceId} (${count})`}
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
      <Pagination page={page} hasMore={pagination.hasMore} buildUrl={buildUrl} />
    </div>
  );
}

function Pagination({
  page,
  hasMore,
  buildUrl,
}: {
  page: number;
  hasMore: boolean;
  buildUrl: (overrides: { page?: string }) => string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <Link
        href={page > 1 ? buildUrl({ page: String(page - 1) }) : "#"}
        aria-disabled={page <= 1}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          page <= 1
            ? "pointer-events-none text-muted-foreground/30"
            : "text-muted-foreground hover:bg-accent",
        )}
      >
        <ChevronLeft size={16} />
        前へ
      </Link>
      <span className="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold tabular-nums">
        ページ {page}
      </span>
      <Link
        href={hasMore ? buildUrl({ page: String(page + 1) }) : "#"}
        aria-disabled={!hasMore}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          !hasMore
            ? "pointer-events-none text-muted-foreground/30"
            : "text-muted-foreground hover:bg-accent",
        )}
      >
        次へ
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}
