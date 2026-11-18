import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LEAD_PRIORITIES, LEAD_SORTS, LEAD_STATUSES, PRIORITY_LABELS, SORT_LABELS, STATUS_LABELS } from "@/lib/leads/fields";
import type { LeadListQuery } from "@/validations/lead";

type Opt = { id: string; name: string };
const sel = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm";

function Select({ name, label, value, children }: { name: string; label: string; value?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">{label}
      <select name={name} defaultValue={value ?? ""} className={sel}>{children}</select>
    </label>
  );
}

// Plain GET form: the URL holds the filters, so views are bookmarkable and need no client code.
export function LeadFilters({
  q, sources, campaigns, teams, owners,
}: { q: LeadListQuery; sources: Opt[]; campaigns: Opt[]; teams: Opt[]; owners: Opt[] }) {
  return (
    <form method="get" action="/leads" className="grid grid-cols-2 items-end gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-4 xl:grid-cols-6">
      <label className="col-span-2 flex flex-col gap-1 text-sm font-medium">Search name, mobile or Lead ID
        <input type="search" name="q" defaultValue={q.q ?? ""} maxLength={100} className={sel} />
      </label>
      <Select name="status" label="Status" value={q.status}>
        <option value="">Any status</option>
        {LEAD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </Select>
      <Select name="priority" label="Priority" value={q.priority}>
        <option value="">Any priority</option>
        {LEAD_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
      </Select>
      <Select name="sourceId" label="Source" value={q.sourceId}>
        <option value="">Any source</option>
        {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
      <Select name="campaignId" label="Campaign" value={q.campaignId}>
        <option value="">Any campaign</option>
        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      {teams.length > 0 && (
        <Select name="teamId" label="Team" value={q.teamId}>
          <option value="">Any team</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      )}
      {owners.length > 0 && (
        <Select name="ownerId" label="Assigned to" value={q.ownerId}>
          <option value="">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      )}
      <Select name="followUp" label="Follow-up" value={q.followUp}>
        <option value="">Any</option>
        <option value="overdue">Overdue</option>
        <option value="today">Due today</option>
      </Select>
      <Select name="work" label="Work status" value={q.work}>
        <option value="">Any</option>
        <option value="unworked">Unworked (no calls yet)</option>
      </Select>
      <label className="flex flex-col gap-1 text-sm font-medium">Created from
        <input type="date" name="createdFrom" defaultValue={q.createdFrom ?? ""} className={sel} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">Created to
        <input type="date" name="createdTo" defaultValue={q.createdTo ?? ""} className={sel} />
      </label>
      <Select name="sort" label="Sort by" value={q.sort}>
        {LEAD_SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
      </Select>
      <Button type="submit">Apply</Button>
      <Link href="/leads" className="flex min-h-11 items-center justify-center text-sm text-brand-700 underline">Clear all</Link>
    </form>
  );
}
