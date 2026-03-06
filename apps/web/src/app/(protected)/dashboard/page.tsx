import { BarChart3, Calendar, MessageSquare, TrendingUp } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { CategoryDistributionChart, TimelineChart } from "@/components/dashboard-charts";
import {
  getInboxCounts,
  getStatsCategories,
  getStatsSpaces,
  getStatsSummary,
  getStatsTimeline,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { InboxStatusBar } from "./inbox-status-bar";

export default async function DashboardPage() {
  const [summary, categoriesData, timelineData, spacesData, inboxData] = await Promise.all([
    getStatsSummary(),
    getStatsCategories(),
    getStatsTimeline({ granularity: "day" }),
    getStatsSpaces(),
    getInboxCounts(),
  ]);

  const counts = inboxData.counts;

  return (
    <div className="space-y-6">
      <AutoRefresh />

      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-accent shadow-sm">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="text-xs text-muted-foreground">メッセージ分析・対応状況の概要</p>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="総メッセージ"
          value={summary.total}
          icon={<MessageSquare className="h-4 w-4" />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <SummaryCard
          label="今日"
          value={summary.today}
          icon={<Calendar className="h-4 w-4" />}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <SummaryCard
          label="今週"
          value={summary.thisWeek}
          icon={<TrendingUp className="h-4 w-4" />}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
        />
        <SummaryCard
          label="未対応"
          value={counts.unresponded}
          icon={<MessageSquare className="h-4 w-4" />}
          iconBg={counts.unresponded > 0 ? "bg-red-100" : "bg-muted"}
          iconColor={counts.unresponded > 0 ? "text-red-600" : "text-muted-foreground"}
        />
      </div>

      {/* Inbox 対応状況バー */}
      <InboxStatusBar counts={counts} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* カテゴリ別分布 */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">カテゴリ別分布</h2>
            <p className="text-xs text-muted-foreground">全{categoriesData.total}件の分類内訳</p>
          </div>
          <CategoryDistributionChart
            data={categoriesData.categories}
            total={categoriesData.total}
          />
        </div>

        {/* スペース別 */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">スペース別メッセージ</h2>
            <p className="text-xs text-muted-foreground">全{spacesData.total}件</p>
          </div>
          <div className="space-y-2.5">
            {spacesData.spaces.map((space) => {
              const pct = spacesData.total > 0 ? (space.count / spacesData.total) * 100 : 0;
              return (
                <div key={space.spaceId} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
                    {space.displayName}
                  </span>
                  <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    <div
                      className="h-full rounded-full bg-[var(--gradient-from)] transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums w-10 text-right flex-shrink-0">
                    {space.count}
                  </span>
                </div>
              );
            })}
            {spacesData.spaces.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">データがありません</p>
            )}
          </div>
        </div>
      </div>

      {/* タイムライン */}
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">メッセージ推移（直近30日）</h2>
          <p className="text-xs text-muted-foreground">
            {timelineData.from.slice(0, 10)} 〜 {timelineData.to.slice(0, 10)}
          </p>
        </div>
        <TimelineChart data={timelineData.timeline} />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconBg)}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
      <span className="text-2xl font-bold tabular-nums">{value.toLocaleString("ja-JP")}</span>
    </div>
  );
}
