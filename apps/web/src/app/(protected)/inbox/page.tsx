import type { ResponseStatus } from "@hr-system/shared";
import { ChevronLeft, ChevronRight, MessageCircle, MessageSquareText } from "lucide-react";
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
import type { ChatMessageDetail, LineMessageDetail } from "@/lib/types";
import { Inbox3Pane } from "./inbox-3pane";
import { LineInbox3Pane } from "./line-inbox-3pane";

type Source = "gchat" | "line";

interface Props {
  searchParams: Promise<{
    source?: string;
    status?: string;
    page?: string;
    id?: string;
  }>;
}

const SOURCE_TABS: { value: Source; label: string; icon: typeof MessageSquareText }[] = [
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
  const source: Source = params.source === "line" ? "line" : "gchat";
  const activeStatus = (params.status as ResponseStatus | undefined) ?? undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const selectedId = params.id ?? null;

  function buildUrl(overrides: { source?: string; status?: string; page?: string; id?: string }) {
    const sp = new URLSearchParams();
    const src = "source" in overrides ? overrides.source : params.source;
    const s = "status" in overrides ? overrides.status : params.status;
    const p = overrides.page;
    const id = "id" in overrides ? overrides.id : params.id;
    if (src && src !== "gchat") sp.set("source", src);
    if (s && s !== "all") sp.set("status", s);
    if (p && p !== "1") sp.set("page", p);
    if (id) sp.set("id", id);
    const qs = sp.toString();
    return `/inbox${qs ? `?${qs}` : ""}`;
  }

  // ソース別のデータ取得
  let gchatMessages: Awaited<ReturnType<typeof getChatMessages>> | null = null;
  let gchatCounts: Awaited<ReturnType<typeof getInboxCounts>> | null = null;
  let selectedChatMessage: ChatMessageDetail | null = null;

  let lineMessages: Awaited<ReturnType<typeof getLineMessages>> | null = null;
  let lineCounts: Awaited<ReturnType<typeof getLineInboxCounts>> | null = null;
  let selectedLineMessage: LineMessageDetail | null = null;

  if (source === "gchat") {
    const [msgResult, countResult, selectedResult] = await Promise.all([
      getChatMessages({ responseStatus: activeStatus, limit: PAGE_SIZE, offset }),
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
      getLineMessages({ responseStatus: activeStatus, limit: PAGE_SIZE, offset }),
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

  const counts = source === "gchat" ? gchatCounts!.counts : lineCounts!.counts;
  const pagination = source === "gchat" ? gchatMessages!.pagination : lineMessages!.pagination;

  const totalActive =
    counts.unresponded + counts.in_progress + counts.responded + counts.not_required;

  function getCount(value: string): number {
    if (value === "all") return totalActive;
    return counts[value as keyof typeof counts] ?? 0;
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

        {/* ステータスタブ */}
        <div className="flex flex-wrap gap-1.5">
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
        </div>
      </div>

      {/* 3ペインレイアウト */}
      {source === "gchat" ? (
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
