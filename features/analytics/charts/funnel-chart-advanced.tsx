"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FunnelStageAdvanced } from "@/types/analytics";

const COLORS = { primary: "#2557D6", secondary: "#0E7490" };

function Frame({ label, summary, children }: { label: string; summary: string; children: React.ReactNode }) {
  return (
    <figure className="m-0" role="img" aria-label={label}>
      <div className="h-80 w-full">{children}</div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

type FunnelChartAdvancedProps = {
  data: FunnelStageAdvanced[];
};

export function FunnelChartAdvanced({ data }: FunnelChartAdvancedProps) {
  const summary = data.map((d) => `${d.stage}: ${d.count} (${d.percentage}%)`).join("; ");

  return (
    <div className="space-y-4">
      <Frame label="Advanced conversion funnel chart showing stage progression" summary={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 80 }}>
            <CartesianGrid stroke="#E3E7EF" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="stage" width={80} tick={{ fontSize: 12 }} />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const data = payload[0].payload as FunnelStageAdvanced;
                return (
                  <div className="rounded-lg border border-line bg-white p-3 shadow-lg">
                    <p className="font-semibold text-ink">{data.stage}</p>
                    <p className="text-sm text-slate-600">
                      Count: <span className="font-semibold">{data.count}</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      Percentage: <span className="font-semibold">{data.percentage}%</span>
                    </p>
                    {data.conversionRate !== null && (
                      <p className="text-sm text-slate-600">
                        Conversion to next: <span className="font-semibold">{data.conversionRate}%</span>
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Bar dataKey="count" name="Leads" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Frame>

      {/* Stage details table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="pb-2 text-left font-semibold text-ink">Stage</th>
              <th className="pb-2 text-right font-semibold text-ink">Count</th>
              <th className="pb-2 text-right font-semibold text-ink">% of Total</th>
              <th className="pb-2 text-right font-semibold text-ink">Conversion Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((stage) => (
              <tr key={stage.stage} className="border-b border-line">
                <td className="py-2 text-slate-700">{stage.stage}</td>
                <td className="py-2 text-right text-ink">{stage.count.toLocaleString()}</td>
                <td className="py-2 text-right text-slate-600">{stage.percentage}%</td>
                <td className="py-2 text-right text-slate-600">
                  {stage.conversionRate !== null ? `${stage.conversionRate}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
