import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { KPIComparison } from "@/types/analytics";

type KPIComparisonCardProps = {
  data: KPIComparison;
};

export function KPIComparisonCard({ data }: KPIComparisonCardProps) {
  const Icon = data.trend === "up" ? TrendingUp : data.trend === "down" ? TrendingDown : Minus;
  const trendColor =
    data.trend === "up" ? "text-green-600" : data.trend === "down" ? "text-red-600" : "text-slate-500";
  const bgColor =
    data.trend === "up" ? "bg-green-50" : data.trend === "down" ? "bg-red-50" : "bg-slate-50";

  return (
    <div className="rounded-card border border-line bg-white p-5">
      <div className="mb-3 text-sm font-medium text-slate-600">{data.label}</div>
      
      <div className="mb-2 text-3xl font-bold text-ink">{data.current.toLocaleString()}</div>
      
      <div className="flex items-center gap-2">
        <div className={`inline-flex items-center gap-1 rounded-full ${bgColor} px-2 py-1 text-xs font-semibold ${trendColor}`}>
          <Icon size={14} />
          <span>{Math.abs(data.change).toFixed(1)}%</span>
        </div>
        <span className="text-xs text-slate-500">vs previous period ({data.previous.toLocaleString()})</span>
      </div>
    </div>
  );
}

type KPIComparisonGridProps = {
  comparisons: KPIComparison[];
};

export function KPIComparisonGrid({ comparisons }: KPIComparisonGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {comparisons.map((comp) => (
        <KPIComparisonCard key={comp.label} data={comp} />
      ))}
    </div>
  );
}
