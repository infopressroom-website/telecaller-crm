import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Kpi } from "@/types/dashboard";

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-5">
      {kpis.map((k) => (
        <Card key={k.key}>
          <p className="text-sm font-medium text-ink-muted">{k.label}</p>
          <p className="mt-1.5 text-3xl font-bold">{k.value.toLocaleString("en-IN")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={k.basis === "period" ? "info" : "neutral"}>{k.basis === "period" ? "In period" : "Snapshot"}</Badge>
            {k.note && <span className="text-xs text-slate-600">{k.note}</span>}
          </div>
        </Card>
      ))}
    </section>
  );
}
