"use client";

import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DailyPoint, FunnelStage } from "@/types/dashboard";

export const COLORS = { primary: "#2557D6", secondary: "#0E7490", tertiary: "#B45309" };

type Series = { key: string; label: string; color: string };

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

export function DailyActivityChart({ data }: { data: DailyPoint[] }) {
  const summary = data.slice(0, 31).map((d) => `${shortDate(d.label)}: ${d.attempts} attempts, ${d.connected} connected`).join("; ");
  return (
    <Frame label="Line chart of call attempts and connected calls over time" summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#E3E7EF" vertical={false} />
          <XAxis dataKey="label" tickFormatter={shortDate} tick={{ fontSize: 12 }} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip labelFormatter={shortDate} />
          <Legend />
          <Line type="monotone" dataKey="attempts" name="Call attempts" stroke={COLORS.primary} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="connected" name="Connected" stroke={COLORS.secondary} strokeWidth={2} dot={false} strokeDasharray="5 3" />
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function FunnelChart({ data }: { data: FunnelStage[] }) {
  const summary = data.map((d) => `${d.stage}: ${d.count}`).join("; ");
  return (
    <Frame label="Bar chart of the lead conversion funnel" summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 24 }}>
          <CartesianGrid stroke="#E3E7EF" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="stage" width={96} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" name="Leads" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function GroupedBarChart({
  data, series, label,
}: { data: Record<string, string | number | null>[]; series: Series[]; label: string }) {
  const summary = data
    .slice(0, 20)
    .map((row) => `${row.name}: ${series.map((s) => `${s.label} ${row[s.key] ?? 0}`).join(", ")}`)
    .join("; ");
  return (
    <Frame label={label} summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#E3E7EF" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          {series.length > 1 && <Legend />}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}
