"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const COLORS = [
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#eab308",
  "#a855f7",
  "#f97316",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#6b7280",
];

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
        {d.value}件 ({d.payload.percentage}%)
      </p>
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
          {data.map((entry, index) => (
            <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
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
