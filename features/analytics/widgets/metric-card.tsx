import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  subtitle?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "flat";
  };
};

export function MetricCard({ label, value, icon: Icon, subtitle, trend }: MetricCardProps) {
  return (
    <div className="rounded-card border border-line bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 text-sm font-medium text-slate-600">{label}</div>
          <div className="text-2xl font-bold text-ink">{typeof value === "number" ? value.toLocaleString() : value}</div>
          {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
        </div>
        {Icon && (
          <div className="rounded-lg bg-brand/10 p-2">
            <Icon size={20} className="text-brand" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 text-xs">
          <span
            className={
              trend.direction === "up"
                ? "text-green-600"
                : trend.direction === "down"
                ? "text-red-600"
                : "text-slate-500"
            }
          >
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.value}%
          </span>
          <span className="ml-1 text-slate-500">vs last period</span>
        </div>
      )}
    </div>
  );
}
