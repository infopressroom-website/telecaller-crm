"use client";

import type { CallPatternData } from "@/types/analytics";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type HeatmapChartProps = {
  data: CallPatternData[];
  title?: string;
};

export function HeatmapChart({ data, title = "Call Activity by Hour" }: HeatmapChartProps) {
  // Find max value for color intensity calculation
  const maxValue = Math.max(...data.map((d) => d.attempts), 1);

  const getColor = (value: number) => {
    const intensity = value / maxValue;
    if (intensity === 0) return "bg-slate-50";
    if (intensity < 0.2) return "bg-blue-100";
    if (intensity < 0.4) return "bg-blue-200";
    if (intensity < 0.6) return "bg-blue-300";
    if (intensity < 0.8) return "bg-blue-400";
    return "bg-blue-500";
  };

  // Group data by hour
  const hourData = HOURS.map((hour) => {
    const hourRow = data.find((d) => d.hour === hour);
    return hourRow || { hour, attempts: 0, connected: 0, connectRate: 0 };
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="overflow-x-auto">
        <div className="inline-grid grid-cols-24 gap-1" style={{ minWidth: "600px" }}>
          {hourData.map((item) => (
            <div
              key={item.hour}
              className={`relative h-16 rounded ${getColor(item.attempts)} transition-colors hover:ring-2 hover:ring-brand`}
              title={`Hour ${item.hour}:00 - ${item.attempts} calls, ${item.connectRate}% connected`}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center text-xs">
                <span className="font-semibold">{item.hour}</span>
                <span className="text-[10px]">{item.attempts}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
          <span>0:00</span>
          <span>12:00</span>
          <span>23:00</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-600">
        <span>Low activity</span>
        <div className="flex gap-1">
          <div className="h-3 w-6 bg-blue-100" />
          <div className="h-3 w-6 bg-blue-200" />
          <div className="h-3 w-6 bg-blue-300" />
          <div className="h-3 w-6 bg-blue-400" />
          <div className="h-3 w-6 bg-blue-500" />
        </div>
        <span>High activity</span>
      </div>
    </div>
  );
}
