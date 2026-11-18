import type { Metadata } from "next";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CallFilters } from "@/features/calls/call-filters";
import { requirePagePermission } from "@/lib/auth/session";
import { canViewRecordings, getCallFilterOptions, listCalls } from "@/services/call-service";
import { parseCallListQuery, type CallListQuery } from "@/validations/calls";

export const metadata: Metadata = { title: "Calls" };
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const TONE: Record<string, BadgeTone> = { COMPLETED: "success", NOT_ANSWERED: "neutral", BUSY: "warning", FAILED: "danger", CANCELED: "neutral", INITIATED: "info", RINGING: "info", IN_PROGRESS: "info" };
const dur = (s: number | null) => (s === null ? "—" : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);

function qs(q: CallListQuery, page: number) {
  const p = new URLSearchParams();
  for (const k of ["q", "agentId", "teamId", "disposition", "direction", "status", "from", "to"] as const) if (q[k]) p.set(k, String(q[k]));
  p.set("page", String(page));
  return p.toString();
}

export default async function CallsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await requirePagePermission("call", "VIEW");
  const q = parseCallListQuery(searchParams);
  const [{ rows, total, meta }, opts] = await Promise.all([listCalls(user, q), getCallFilterOptions(user)]);
  const recordings = canViewRecordings(user);
  return (
    <>
      <PageHeader title={user.roleKey === "TELECALLER" ? "My calls" : "Call history"} description={`${total.toLocaleString("en-IN")} call${total === 1 ? "" : "s"} match your filters`} />
      <CallFilters q={q} agents={opts.agents} teams={opts.teams} dispositions={opts.dispositions} />
      {rows.length === 0 ? <EmptyState title="No calls match" description="Try clearing some filters." /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-line text-ink-muted">{["When", "Lead", "Agent", "Direction", "Status", "Outcome", "Talk time", ""].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-3">{when.format(c.startedAt ?? c.createdAt)}</td>
                  <td className="px-3 py-3"><Link href={`/calls/${c.id}`} className="font-medium text-brand-700 underline">{c.lead.name}</Link><div className="text-xs text-ink-muted">{c.lead.leadCode}</div></td>
                  <td className="px-3 py-3">{c.agent.name}{c.agent.team && <div className="text-xs text-ink-muted">{c.agent.team.name}</div>}</td>
                  <td className="px-3 py-3">{c.direction === "INBOUND" ? "Inbound" : "Outbound"}</td>
                  <td className="px-3 py-3"><Badge tone={TONE[c.status] ?? "neutral"}>{c.status.replace(/_/g, " ").toLowerCase()}</Badge>{c.providerName === "sandbox" && <> <Badge tone="warning">sandbox</Badge></>}</td>
                  <td className="px-3 py-3">{c.disposition?.label ?? <span className="text-ink-muted">Not recorded</span>}</td>
                  <td className="whitespace-nowrap px-3 py-3">{dur(c.durationSec)}</td>
                  <td className="px-3 py-3">{recordings && c.recording ? <Link href={`/calls/${c.id}`} className="text-xs text-brand-700 underline">Recording</Link> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">Page {meta.page} of {meta.totalPages}</span>
        <div className="flex gap-2">
          {meta.page > 1 ? <Link href={`/calls?${qs(q, meta.page - 1)}`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Previous</Link> : <Button variant="secondary" disabled>Previous</Button>}
          {meta.page < meta.totalPages ? <Link href={`/calls?${qs(q, meta.page + 1)}`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Next</Link> : <Button variant="secondary" disabled>Next</Button>}
        </div>
      </nav>
    </>
  );
}
