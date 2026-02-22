"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ConfidenceTimelinePoint, OverrideRatePoint } from "@/lib/types";

export function ConfidenceTimelineChart({ data }: { data: ConfidenceTimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={11} />
        <YAxis
          domain={[0, 1]}
          fontSize={11}
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
        />
        <Tooltip
          formatter={(value: number | undefined, name: string | undefined) => [
            value != null ? `${(value * 100).toFixed(1)}%` : "N/A",
            name === "avg" ? "平均" : name === "min" ? "最小" : "最大",
          ]}
        />
        <Legend
          formatter={(value: string) =>
            value === "avg" ? "平均" : value === "min" ? "最小" : "最大"
          }
        />
        <Line
          type="monotone"
          dataKey="avg"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="min"
          stroke="#9ca3af"
          strokeWidth={1}
          strokeDasharray="4 4"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="max"
          stroke="#9ca3af"
          strokeWidth={1}
          strokeDasharray="4 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function OverrideRateChart({ data }: { data: OverrideRatePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={11} />
        <YAxis yAxisId="left" fontSize={11} />
        <YAxis
          yAxisId="right"
          orientation="right"
          fontSize={11}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          formatter={(value: number | undefined, name: string | undefined) => {
            const v = value ?? 0;
            if (name === "overrideRate") return [`${v}%`, "Override率"];
            if (name === "total") return [`${v}件`, "総件数"];
            return [`${v}件`, "Override件数"];
          }}
        />
        <Legend
          formatter={(value: string) => {
            if (value === "total") return "総件数";
            if (value === "overrideRate") return "Override率";
            return "Override件数";
          }}
        />
        <Bar yAxisId="left" dataKey="total" fill="#93c5fd" radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="overrideRate"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
