"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryStat, TimelinePoint } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  salary: "#22c55e",
  retirement: "#ef4444",
  hiring: "#3b82f6",
  contract: "#eab308",
  transfer: "#a855f7",
  foreigner: "#f97316",
  training: "#6366f1",
  health_check: "#ec4899",
  attendance: "#14b8a6",
  other: "#6b7280",
};

function formatCount(value: number | undefined): [string, string] {
  return [`${value ?? 0}件`, "件数"];
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: CategoryStat }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  if (!d) return null;
  return (
    <div className="rounded border bg-background px-3 py-2 shadow-md text-sm">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground">
        {d.value.toLocaleString("ja-JP")}件 ({d.payload.percentage}%)
      </p>
    </div>
  );
}

export function CategoryDistributionChart({
  data,
  total,
}: {
  data: CategoryStat[];
  total: number;
}) {
  const filtered = data.filter((d) => d.count > 0);
  const sorted = [...filtered].sort((a, b) => b.count - a.count);
  const maxCount = sorted[0]?.count ?? 1;

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
      {/* コンパクトドーナツ（固定200×200px） */}
      <div className="shrink-0">
        <PieChart width={200} height={200}>
          <Pie
            data={filtered}
            dataKey="count"
            nameKey="label"
            cx={100}
            cy={100}
            innerRadius={62}
            outerRadius={92}
            animationBegin={0}
            animationDuration={600}
            strokeWidth={0}
          >
            {filtered.map((entry) => (
              <Cell
                key={entry.category}
                fill={CATEGORY_COLORS[entry.category] ?? "#6b7280"}
                opacity={entry.category === "other" ? 0.45 : 1}
              />
            ))}
            <Label
              content={(props) => {
                const vb = props.viewBox as { cx?: number; cy?: number } | undefined;
                const cx = vb?.cx ?? 100;
                const cy = vb?.cy ?? 100;
                return (
                  <text x={cx} y={cy} textAnchor="middle">
                    <tspan
                      x={cx}
                      y={cy - 7}
                      fontSize={22}
                      fontWeight={700}
                      className="fill-foreground"
                    >
                      {total.toLocaleString("ja-JP")}
                    </tspan>
                    <tspan x={cx} y={cy + 13} fontSize={11} fill="#6b7280">
                      件
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
          <Tooltip content={<PieTooltip />} />
        </PieChart>
      </div>

      {/* カテゴリランキングリスト */}
      <div className="flex-1 min-w-0 space-y-2 w-full">
        {sorted.map((item) => (
          <div
            key={item.category}
            className="flex items-center gap-2.5 px-1 py-0.5 rounded hover:bg-muted/50 transition-colors"
          >
            {/* カラードット */}
            <span
              className="shrink-0 h-2 w-2 rounded-full"
              style={{
                backgroundColor: CATEGORY_COLORS[item.category] ?? "#6b7280",
                opacity: item.category === "other" ? 0.45 : 1,
              }}
            />
            {/* カテゴリ名 */}
            <span className="text-xs text-muted-foreground shrink-0 w-48 truncate">
              {item.label}
            </span>
            {/* プログレスバー */}
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-0">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  backgroundColor: CATEGORY_COLORS[item.category] ?? "#6b7280",
                  opacity: item.category === "other" ? 0.45 : 1,
                }}
              />
            </div>
            {/* 件数・パーセンテージ */}
            <div className="shrink-0 flex items-center gap-1.5 w-28 justify-end">
              <span className="text-xs font-semibold tabular-nums">
                {item.count.toLocaleString("ja-JP")}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                {item.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryPieChart({ data }: { data: CategoryStat[] }) {
  const filtered = data.filter((d) => d.count > 0);
  return (
    <ResponsiveContainer width="100%" height={420}>
      <PieChart>
        <Pie data={filtered} dataKey="count" nameKey="label" cx="50%" cy="42%" outerRadius={110}>
          {filtered.map((entry) => (
            <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? "#6b7280"} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
        <Legend
          // biome-ignore lint/suspicious/noExplicitAny: Recharts LegendPayload does not expose pie data type
          formatter={(value: string, entry: any) =>
            `${value} ${(entry?.payload as CategoryStat | undefined)?.percentage ?? ""}%`
          }
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryBarChart({ data }: { data: CategoryStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis type="category" dataKey="label" width={100} fontSize={12} />
        <Tooltip formatter={formatCount} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? "#6b7280"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TimelineChart({ data }: { data: TimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={11} />
        <YAxis fontSize={11} />
        <Tooltip formatter={formatCount} />
        <Legend />
        <Line
          type="monotone"
          dataKey="count"
          name="メッセージ数"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
