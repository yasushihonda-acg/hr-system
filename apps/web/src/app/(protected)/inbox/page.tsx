import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getChatMessages, getInboxCounts } from "@/lib/api";
import { InboxList } from "./inbox-list";

interface Props {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

type ResponseStatus = "unresponded" | "in_progress" | "responded" | "not_required";

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
  const activeStatus = (params.status as ResponseStatus | undefined) ?? undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [{ data: messages, pagination }, { counts }] = await Promise.all([
    getChatMessages({
      responseStatus: activeStatus,
      limit: PAGE_SIZE,
      offset,
    }),
    getInboxCounts(),
  ]);

  function buildUrl(overrides: { status?: string; page?: string }) {
    const sp = new URLSearchParams();
    const s = "status" in overrides ? overrides.status : params.status;
    const p = overrides.page;
    if (s && s !== "all") sp.set("status", s);
    if (p && p !== "1") sp.set("page", p);
    const qs = sp.toString();
    return `/inbox${qs ? `?${qs}` : ""}`;
  }

  const totalActive =
    counts.unresponded + counts.in_progress + counts.responded + counts.not_required;

  function getCount(value: string): number {
    if (value === "all") return totalActive;
    return counts[value as keyof typeof counts] ?? 0;
  }

  return (
    <div className="-mx-4 -mt-4 min-h-screen bg-slate-50/80 px-4 pt-4">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">受信箱</h1>
          <p className="mt-0.5 text-xs text-slate-500">チャットメッセージの対応状況を管理</p>
        </div>

        {/* Status tabs */}
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
                })}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    isActive ? "bg-white/20" : "bg-slate-100"
                  }`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Message list */}
        <InboxList messages={messages} />

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
