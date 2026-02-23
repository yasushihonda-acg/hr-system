"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: CategoryStat }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  if (!d) return null;
  return (
    <div className="rounded border bg-background px-3 py-2 shadow-md text-sm">
      <p className="font-semibold">{d.payload.label}</p>
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
  const [view, setView] = useState<"donut" | "bar">("donut");
  const filtered = data.filter((d) => d.count > 0);
  const sorted = [...filtered].sort((a, b) => b.count - a.count);

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as "donut" | "bar")}>
      <TabsList className="mb-2">
        <TabsTrigger value="donut">ドーナツ</TabsTrigger>
        <TabsTrigger value="bar">横棒グラフ</TabsTrigger>
      </TabsList>

      <TabsContent value="donut">
        <ResponsiveContainer width="100%" height={420}>
          <PieChart>
            <Pie
              data={filtered}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="42%"
              innerRadius={75}
              outerRadius={115}
              animationBegin={0}
              animationDuration={600}
            >
              {filtered.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={CATEGORY_COLORS[entry.category] ?? "#6b7280"}
                  opacity={entry.category === "other" ? 0.5 : 1}
                />
              ))}
              <Label
                content={(props) => {
                  const vb = props.viewBox as { cx?: number; cy?: number } | undefined;
                  const cx = vb?.cx ?? 0;
                  const cy = vb?.cy ?? 0;
                  return (
                    <text x={cx} y={cy} textAnchor="middle">
                      <tspan
                        x={cx}
                        y={cy - 8}
                        fontSize={26}
                        fontWeight={700}
                        className="fill-foreground"
                      >
                        {total.toLocaleString("ja-JP")}
                      </tspan>
                      <tspan x={cx} y={cy + 16} fontSize={12} fill="#6b7280">
                        件
                      </tspan>
                    </text>
                  );
                }}
              />
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
      </TabsContent>

      <TabsContent value="bar">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" fontSize={11} />
            <YAxis type="category" dataKey="label" width={168} fontSize={11} />
            <Tooltip content={<BarTooltip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {sorted.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={CATEGORY_COLORS[entry.category] ?? "#6b7280"}
                  opacity={entry.category === "other" ? 0.5 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </TabsContent>
    </Tabs>
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
