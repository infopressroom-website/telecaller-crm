import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CALL_STATUSES, type CallListQuery } from "@/validations/calls";

const sel = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm";
type Opt = { id: string; name: string };

const Pick = ({ name, label, value, children }: { name: string; label: string; value?: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1 text-sm font-medium">{label}<select name={name} defaultValue={value ?? ""} className={sel}>{children}</select></label>
);

export function CallFilters({ q, agents, teams, dispositions }: { q: CallListQuery; agents: Opt[]; teams: Opt[]; dispositions: { key: string; label: string }[] }) {
  return (
    <form method="get" action="/calls" className="grid grid-cols-2 items-end gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-4 xl:grid-cols-6">
      <label className="col-span-2 flex flex-col gap-1 text-sm font-medium">Lead name, Lead ID or mobile
        <input type="search" name="q" defaultValue={q.q ?? ""} maxLength={100} className={sel} />
      </label>
      {agents.length > 0 && <Pick name="agentId" label="Agent" value={q.agentId}><option value="">Any agent</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Pick>}
      {teams.length > 0 && <Pick name="teamId" label="Team" value={q.teamId}><option value="">Any team</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Pick>}
      <Pick name="disposition" label="Outcome" value={q.disposition}><option value="">Any outcome</option>{dispositions.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</Pick>
      <Pick name="direction" label="Direction" value={q.direction}><option value="">Both</option><option value="OUTBOUND">Outbound</option><option value="INBOUND">Inbound</option></Pick>
      <Pick name="status" label="Call status" value={q.status}><option value="">Any status</option>{CALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}</Pick>
      <label className="flex flex-col gap-1 text-sm font-medium">From<input type="date" name="from" defaultValue={q.from ?? ""} className={sel} /></label>
      <label className="flex flex-col gap-1 text-sm font-medium">To<input type="date" name="to" defaultValue={q.to ?? ""} className={sel} /></label>
      <Button type="submit">Apply</Button>
      <Link href="/calls" className="flex min-h-11 items-center justify-center text-sm text-brand-700 underline">Clear all</Link>
    </form>
  );
}
