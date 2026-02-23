import { MessageSquare, TrendingUp } from "lucide-react";
import { CategoryDistributionChart, TimelineChart } from "@/components/dashboard-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatsCategories, getStatsSpaces, getStatsSummary, getStatsTimeline } from "@/lib/api";

export default async function DashboardPage() {
  const [summary, categoriesData, timelineData, spacesData] = await Promise.all([
    getStatsSummary(),
    getStatsCategories(),
    getStatsTimeline({ granularity: "day" }),
    getStatsSpaces(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      {/* サマリーカード */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="総メッセージ数"
          value={summary.total}
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="今日"
          value={summary.today}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="今週"
          value={summary.thisWeek}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="今月"
          value={summary.thisMonth}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* カテゴリ別集計 */}
      <Card>
        <CardHeader>
          <CardTitle>カテゴリ別分布</CardTitle>
          <CardDescription>全{categoriesData.total}件の分類内訳</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryDistributionChart
            data={categoriesData.categories}
            total={categoriesData.total}
          />
        </CardContent>
      </Card>

      {/* タイムライン */}
      <Card>
        <CardHeader>
          <CardTitle>メッセージ推移（直近30日）</CardTitle>
          <CardDescription>
            {timelineData.from.slice(0, 10)} 〜 {timelineData.to.slice(0, 10)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimelineChart data={timelineData.timeline} />
        </CardContent>
      </Card>

      {/* スペース別 */}
      <Card>
        <CardHeader>
          <CardTitle>スペース別メッセージ数</CardTitle>
          <CardDescription>全{spacesData.total}件</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {spacesData.spaces.map((space) => (
              <div key={space.spaceId} className="flex items-center justify-between">
                <span className="text-sm font-medium truncate max-w-[300px]">{space.spaceId}</span>
                <div className="flex items-center gap-3">
                  <div className="h-2 rounded-full bg-primary/20 w-[200px]">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${spacesData.total > 0 ? (space.count / spacesData.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground tabular-nums w-12 text-right">
                    {space.count}件
                  </span>
                </div>
              </div>
            ))}
            {spacesData.spaces.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">データがありません</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString("ja-JP")}</div>
      </CardContent>
    </Card>
  );
}
