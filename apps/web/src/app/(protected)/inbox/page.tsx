import type { ChatCategory, ResponseStatus } from "@hr-system/shared";

import { ChevronLeft, ChevronRight, Inbox, MessageCircle, MessageSquareText } from "lucide-react";
import Link from "next/link";
import {
  ApiError,
  getChatMessage,
  getChatMessages,
  getInboxCounts,
  getLineInboxCounts,
  getLineMessage,
  getLineMessages,
} from "@/lib/api";
import { CATEGORY_OPTIONS } from "@/lib/constants";
import type {
  ChatMessageDetail,
  LineMessageDetail,
  UnifiedMessageDetail,
  UnifiedMessageSummary,
} from "@/lib/types";
import { Inbox3Pane } from "./inbox-3pane";
import { LineInbox3Pane } from "./line-inbox-3pane";
import { UnifiedInbox3Pane } from "./unified-inbox-3pane";

type Source = "all" | "gchat" | "line";

interface Props {
  searchParams: Promise<{
    source?: string;
    status?: string;
    category?: string;
    page?: string;
    id?: string;
  }>;
}

const SOURCE_TABS: { value: Source; label: string; icon: typeof MessageSquareText }[] = [
  { value: "all", label: "すべて", icon: Inbox },
  { value: "gchat", label: "Google Chat", icon: MessageSquareText },
  { value: "line", label: "LINE", icon: MessageCircle },
];

const STATUS_TABS: { value: ResponseStatus | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "unresponded", label: "未対応" },
  { value: "in_progress", label: "対応中" },
  { value: "responded", label: "対応済" },
  { value: "not_required", label: "対応不要" },
];

const PAGE_SIZE = 30;

export default async function InboxPage({ searchParams }: Props) {
  const params = await searchParams;
  const source: Source =
    params.source === "line" ? "line" : params.source === "gchat" ? "gchat" : "all";
  const activeStatus = (params.status as ResponseStatus | undefined) ?? undefined;
  const activeCategory = (params.category as ChatCategory | undefined) ?? undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const selectedId = params.id ?? null;

  function buildUrl(overrides: {
    source?: string;
    status?: string;
    category?: string;
    page?: string;
    id?: string;
  }) {
    const sp = new URLSearchParams();
    const src = "source" in overrides ? overrides.source : params.source;
    const s = "status" in overrides ? overrides.status : params.status;
    const cat = "category" in overrides ? overrides.category : params.category;
    const p = overrides.page;
    const id = "id" in overrides ? overrides.id : params.id;
    if (src && src !== "all") sp.set("source", src);
    if (s && s !== "all") sp.set("status", s);
    if (cat && cat !== "all") sp.set("category", cat);
    if (p && p !== "1") sp.set("page", p);
    if (id) sp.set("id", id);
    const qs = sp.toString();
    return `/inbox${qs ? `?${qs}` : ""}`;
  }

  // --- データ取得 ---
  let gchatMessages: Awaited<ReturnType<typeof getChatMessages>> | null = null;
  let gchatCounts: Awaited<ReturnType<typeof getInboxCounts>> | null = null;
  let selectedChatMessage: ChatMessageDetail | null = null;

  let lineMessages: Awaited<ReturnType<typeof getLineMessages>> | null = null;
  let lineCounts: Awaited<ReturnType<typeof getLineInboxCounts>> | null = null;
  let selectedLineMessage: LineMessageDetail | null = null;

  if (source === "all") {
    // 両ソースを並列取得
    const halfLimit = Math.ceil(PAGE_SIZE / 2);
    const halfOffset = (page - 1) * halfLimit;

    const [gchatResult, lineResult, gchatCountResult, lineCountResult, chatSel, lineSel] =
      await Promise.all([
        getChatMessages({
          responseStatus: activeStatus,
          category: activeCategory,
          limit: halfLimit,
          offset: halfOffset,
        }),
        getLineMessages({
          responseStatus: activeStatus,
          category: activeCategory,
          limit: halfLimit,
          offset: halfOffset,
        }),
        getInboxCounts(),
        getLineInboxCounts(),
        selectedId ? getChatMessage(selectedId).catch(() => null) : Promise.resolve(null),
        selectedId ? getLineMessage(selectedId).catch(() => null) : Promise.resolve(null),
      ]);

    gchatMessages = gchatResult;
    lineMessages = lineResult;
    gchatCounts = gchatCountResult;
    lineCounts = lineCountResult;
    selectedChatMessage = chatSel;
    selectedLineMessage = lineSel;
  } else if (source === "gchat") {
    const [msgResult, countResult, selectedResult] = await Promise.all([
      getChatMessages({
        responseStatus: activeStatus,
        category: activeCategory,
        limit: PAGE_SIZE,
        offset,
      }),
      getInboxCounts(),
      selectedId
        ? getChatMessage(selectedId).catch((err) => {
            if (!(err instanceof ApiError && err.status === 404)) {
              console.error("Failed to fetch message:", err);
            }
            return null;
          })
        : Promise.resolve(null),
    ]);
    gchatMessages = msgResult;
    gchatCounts = countResult;
    selectedChatMessage = selectedResult;
  } else {
    const [msgResult, countResult, selectedResult] = await Promise.all([
      getLineMessages({
        responseStatus: activeStatus,
        category: activeCategory,
        limit: PAGE_SIZE,
        offset,
      }),
      getLineInboxCounts(),
      selectedId
        ? getLineMessage(selectedId).catch((err) => {
            if (!(err instanceof ApiError && err.status === 404)) {
              console.error("Failed to fetch LINE message:", err);
            }
            return null;
          })
        : Promise.resolve(null),
    ]);
    lineMessages = msgResult;
    lineCounts = countResult;
    selectedLineMessage = selectedResult;
  }

  // --- カウント・ページネーション算出 ---
  let counts: { unresponded: number; in_progress: number; responded: number; not_required: number };
  let hasMore: boolean;

  if (source === "all") {
    const gc = gchatCounts!.counts;
    const lc = lineCounts!.counts;
    counts = {
      unresponded: gc.unresponded + lc.unresponded,
      in_progress: gc.in_progress + lc.in_progress,
      responded: gc.responded + lc.responded,
      not_required: gc.not_required + lc.not_required,
    };
    hasMore = gchatMessages!.pagination.hasMore || lineMessages!.pagination.hasMore;
  } else if (source === "gchat") {
    counts = gchatCounts!.counts;
    hasMore = gchatMessages!.pagination.hasMore;
  } else {
    counts = lineCounts!.counts;
    hasMore = lineMessages!.pagination.hasMore;
  }

  const totalActive =
    counts.unresponded + counts.in_progress + counts.responded + counts.not_required;

  function getCount(value: string): number {
    if (value === "all") return totalActive;
    return counts[value as keyof typeof counts] ?? 0;
  }

  // --- 統合ビュー用のデータ構築 ---
  let unifiedMessages: UnifiedMessageSummary[] = [];
  let unifiedSelected: UnifiedMessageDetail | null = null;

  if (source === "all") {
    const gchatTagged: UnifiedMessageSummary[] = (gchatMessages?.data ?? []).map((m) => ({
      ...m,
      source: "gchat" as const,
    }));
    const lineTagged: UnifiedMessageSummary[] = (lineMessages?.data ?? []).map((m) => ({
      ...m,
      source: "line" as const,
    }));
    unifiedMessages = [...gchatTagged, ...lineTagged].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    if (selectedChatMessage) {
      unifiedSelected = { ...selectedChatMessage, source: "gchat" as const };
    } else if (selectedLineMessage) {
      unifiedSelected = { ...selectedLineMessage, source: "line" as const };
    }
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-52px)] flex-col">
      {/* ヘッダー: ソースタブ + ステータスタブ */}
      <div className="flex-shrink-0 border-b border-border/60 bg-white px-5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">受信箱</h1>
          <span className="text-xs text-muted-foreground">全{totalActive}件</span>
        </div>

        {/* ソースタブ */}
        <div className="mb-2 flex gap-1">
          {SOURCE_TABS.map((tab) => {
            const isActive = source === tab.value;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.value}
                href={buildUrl({
                  source: tab.value,
                  status: undefined,
                  category: undefined,
                  page: "1",
                  id: undefined,
                })}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* ステータスタブ + カテゴリフィルター */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.value === "all" ? !activeStatus : activeStatus === tab.value;
            const count = getCount(tab.value);
            return (
              <Link
                key={tab.value}
                href={buildUrl({
                  status: tab.value === "all" ? undefined : tab.value,
                  page: "1",
                  id: undefined,
                })}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    isActive ? "bg-white/20" : "bg-slate-100"
                  }`}
                >
                  {count}
                </span>
              </Link>
            );
          })}

          {/* カテゴリフィルター */}
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <div className="flex flex-wrap gap-1">
            {CATEGORY_OPTIONS.map((opt) => {
              const isActive = opt.value === "all" ? !activeCategory : activeCategory === opt.value;
              return (
                <Link
                  key={opt.value}
                  href={buildUrl({
                    category: opt.value === "all" ? undefined : opt.value,
                    page: "1",
                    id: undefined,
                  })}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    isActive
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3ペインレイアウト */}
      {source === "all" ? (
        <UnifiedInbox3Pane
          messages={unifiedMessages}
          selectedMessage={unifiedSelected}
          selectedId={selectedId}
        />
      ) : source === "gchat" ? (
        <Inbox3Pane
          messages={gchatMessages!.data}
          selectedMessage={selectedChatMessage}
          selectedId={selectedId}
        />
      ) : (
        <LineInbox3Pane
          messages={lineMessages!.data}
          selectedMessage={selectedLineMessage}
          selectedId={selectedId}
        />
      )}

      {/* ページネーション */}
      <div className="flex-shrink-0 border-t border-border/60 bg-white px-5 py-2">
        <div className="flex items-center justify-center gap-2">
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
            href={hasMore ? buildUrl({ page: String(page + 1) }) : "#"}
            aria-disabled={!hasMore}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              !hasMore ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-100"
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
