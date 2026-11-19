import { Filter } from "lucide-react";
import type { AnalyticsFilters } from "@/types/analytics";

type FilterBarProps = {
  filters: AnalyticsFilters;
  teams: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
  sources: { id: string; name: string }[];
};

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "custom", label: "Custom range" },
];

export function AnalyticsFilterBar({ filters, teams, campaigns, sources }: FilterBarProps) {
  const showCustom = filters.range.preset === "custom";

  return (
    <form method="GET" className="rounded-card border border-line bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Filter size={16} />
        <span>Filters</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Period selector */}
        <div>
          <label htmlFor="preset" className="mb-1 block text-sm font-medium text-slate-700">
            Period
          </label>
          <select
            id="preset"
            name="preset"
            defaultValue={filters.range.preset}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom date range */}
        {showCustom && (
          <>
            <div>
              <label htmlFor="from" className="mb-1 block text-sm font-medium text-slate-700">
                From
              </label>
              <input
                type="date"
                id="from"
                name="from"
                defaultValue={filters.range.from.toISOString().split("T")[0]}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="to" className="mb-1 block text-sm font-medium text-slate-700">
                To
              </label>
              <input
                type="date"
                id="to"
                name="to"
                defaultValue={filters.range.to.toISOString().split("T")[0]}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </>
        )}

        {/* Team filter */}
        <div>
          <label htmlFor="teamId" className="mb-1 block text-sm font-medium text-slate-700">
            Team
          </label>
          <select
            id="teamId"
            name="teamId"
            defaultValue={filters.teamId || ""}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">All teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        {/* Campaign filter */}
        <div>
          <label htmlFor="campaignId" className="mb-1 block text-sm font-medium text-slate-700">
            Campaign
          </label>
          <select
            id="campaignId"
            name="campaignId"
            defaultValue={filters.campaignId || ""}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">All campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>

        {/* Source filter */}
        <div>
          <label htmlFor="sourceId" className="mb-1 block text-sm font-medium text-slate-700">
            Source
          </label>
          <select
            id="sourceId"
            name="sourceId"
            defaultValue={filters.sourceId || ""}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="inline-flex min-h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand/90"
        >
          Apply Filters
        </button>
        <a
          href="/analytics"
          className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reset
        </a>
      </div>

      {filters.notice && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {filters.notice}
        </div>
      )}
    </form>
  );
}
