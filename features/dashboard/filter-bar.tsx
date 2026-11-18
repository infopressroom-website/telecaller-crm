import { Button } from "@/components/ui/button";
import type { DashboardFilters } from "@/lib/dashboard-filters";
import { PRESET_LABELS, PRESET_VALUES, dayKeyIST, addDays } from "@/lib/date-range";
import type { FilterOptions } from "@/types/dashboard";

const selectClass = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm";

// Plain GET form: the URL is the single source of truth, so filtered views are shareable and need no client JS.
export function FilterBar({ filters, options, action = "/dashboard", children }: { filters: DashboardFilters; options: FilterOptions; action?: string; children?: React.ReactNode }) {
  const { range } = filters;
  const customFrom = range.preset === "custom" ? dayKeyIST(range.from) : "";
  const customTo = range.preset === "custom" ? dayKeyIST(addDays(range.to, -1)) : "";
  return (
    <form method="get" action={action} className="grid grid-cols-2 items-end gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Period
        <select name="preset" defaultValue={range.preset} className={selectClass}>
          {PRESET_VALUES.map((p) => <option key={p} value={p}>{PRESET_LABELS[p]}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        From <span className="sr-only">(custom range only)</span>
        <input type="date" name="from" defaultValue={customFrom} className={selectClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        To <span className="sr-only">(custom range only)</span>
        <input type="date" name="to" defaultValue={customTo} className={selectClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Team
        <select name="teamId" defaultValue={filters.teamId ?? ""} className={selectClass}>
          <option value="">All teams</option>
          {options.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Campaign
        <select name="campaignId" defaultValue={filters.campaignId ?? ""} className={selectClass}>
          <option value="">All campaigns</option>
          {options.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      {children}
      <Button type="submit">Apply filters</Button>
      <p className="col-span-full text-xs text-ink-muted">Dates apply when Period is “Custom range”. All times are India Standard Time.</p>
    </form>
  );
}
