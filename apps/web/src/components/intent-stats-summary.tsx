import { BarChart3, Percent, RefreshCw, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntentStatsSummary } from "@/lib/types";

export function IntentStatsSummaryCards({ data }: { data: IntentStatsSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="総分類数"
        value={data.total.toLocaleString("ja-JP")}
        description={`AI: ${data.byMethod.ai} / 正規表現: ${data.byMethod.regex} / 手動: ${data.byMethod.manual}`}
        icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
      />
      <SummaryCard
        title="Override率"
        value={`${data.overrideRate}%`}
        description={`${data.overrideCount}件が手動修正`}
        icon={<RefreshCw className="h-4 w-4 text-muted-foreground" />}
      />
      <SummaryCard
        title="平均Confidence (AI)"
        value={
          data.avgConfidence.ai != null ? `${(data.avgConfidence.ai * 100).toFixed(1)}%` : "N/A"
        }
        icon={<Target className="h-4 w-4 text-muted-foreground" />}
      />
      <SummaryCard
        title="平均Confidence (Regex)"
        value={
          data.avgConfidence.regex != null
            ? `${(data.avgConfidence.regex * 100).toFixed(1)}%`
            : "N/A"
        }
        icon={<Percent className="h-4 w-4 text-muted-foreground" />}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}
