"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/types/analytics";

export const COLORS = { primary: "#2557D6", secondary: "#0E7490", tertiary: "#B45309", quaternary: "#7C3AED" };

type Series = { key: string; label: string; color: string; dashed?: boolean };

function Frame({ label, summary, children }: { label: string; summary: string; children: React.ReactNode }) {
  return (
    <figure className="m-0" role="img" aria-label={label}>
      <div className="h-64 w-full">{children}</div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

const shortDate = (label: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(label)
    ? new Date(`${label}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })
    : label;

type TrendChartProps = {
  data: TrendPoint[];
  series: Series[];
  label: string;
  showMovingAvg?: boolean;
};

export function TrendChart({ data, series, label, showMovingAvg = false }: TrendChartProps) {
  const summary = data
    .slice(0, 10)
    .map((d) => `${shortDate(d.date)}: ${d.value}`)
    .join("; ");

  return (
    <Frame label={label} summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#E3E7EF" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12 }} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip labelFormatter={shortDate} />
          <Legend />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              strokeDasharray={s.dashed ? "5 3" : undefined}
            />
          ))}
          {showMovingAvg && (
            <Line
              type="monotone"
              dataKey="movingAvg"
              name="7-day avg"
              stroke={COLORS.tertiary}
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 3"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}
