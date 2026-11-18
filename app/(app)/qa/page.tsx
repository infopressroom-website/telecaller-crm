import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { scoreBand } from "@/lib/qa/scorecard";
import { listQueue, listReviews, qaAgentOptions } from "@/services/qa-service";

export const metadata: Metadata = { title: "Quality assurance" };
export const dynamic = "force-dynamic";
const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function QaPage({ searchParams }: { searchParams: { tab?: string; agentId?: string; page?: string } }) {
  const user = await requirePagePermission("qa", "VIEW");
  const tab = searchParams.tab === "reviewed" ? "reviewed" : "queue";
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const agentId = searchParams.agentId || undefined;
  const [agents, queue, reviews] = await Promise.all([qaAgentOptions(user), tab === "queue" ? listQueue(user, { agentId, page, pageSize: 20 }) : null, tab === "reviewed" ? listReviews(user, { agentId, page, pageSize: 20 }) : null]);
  const meta = (queue ?? reviews)!.meta;
  const href = (o: { tab?: string; page?: number }) => `/qa?tab=${o.tab ?? tab}&agentId=${agentId ?? ""}&page=${o.page ?? 1}`;
  return (
    <>
      <PageHeader title="Quality assurance" description="Review calls against the scorecard. Calls with recordings are listed first." />
      <div className="flex flex-wrap items-end gap-3">
        {[["queue", "To review"], ["reviewed", "Reviewed"]].map(([k, l]) => <Link key={k} href={href({ tab: k })} aria-current={k === tab ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold ${k === tab ? "bg-brand text-white" : "border border-line bg-white"}`}>{l}</Link>)}
        {agents.length > 0 && <form method="get" action="/qa" className="flex items-end gap-2"><input type="hidden" name="tab" value={tab} /><label className="flex flex-col gap-1 text-xs font-medium">Telecaller<select name="agentId" defaultValue={agentId ?? ""} className="h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm"><option value="">Everyone</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><button className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold">Filter</button></form>}
      </div>
      <Card>
        {queue && (queue.rows.length === 0 ? <EmptyState title="Nothing waiting for review" /> : (
          <ul className="divide-y divide-slate-100 text-sm">{queue.rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{c.lead.name} <span className="text-xs font-normal text-ink-muted">{c.lead.leadCode}</span></p><p className="text-xs text-ink-muted">{c.agent.name} · {c.disposition?.label} · {when.format(c.createdAt)}{c.durationSec ? ` · ${c.durationSec}s` : ""} {c.recording && <Badge tone="info">recording</Badge>}</p></div>
              {user.roleKey && <Link href={`/qa/review/${c.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">Review</Link>}</li>))}</ul>
        ))}
        {reviews && (reviews.rows.length === 0 ? <EmptyState title="No reviews yet" /> : (
          <ul className="divide-y divide-slate-100 text-sm">{reviews.rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{r.agent.name}: {r.score ?? "—"}% <span className="text-xs font-normal text-ink-muted">({scoreBand(r.score)})</span></p><p className="text-xs text-ink-muted">Reviewed by {r.reviewer.name} · {when.format(r.createdAt)}{r.feedback ? ` · ${r.feedback.slice(0, 80)}` : ""}</p></div><Link href={`/qa/review/${r.callId}`} className="text-brand-700 underline">Open</Link></li>))}</ul>
        ))}
      </Card>
      <nav aria-label="Pagination" className="flex items-center justify-between text-sm"><span className="text-ink-muted">Page {meta.page} of {meta.totalPages}</span>
        <div className="flex gap-2">{meta.page > 1 ? <Link href={href({ page: meta.page - 1 })} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Previous</Link> : <Button variant="secondary" disabled>Previous</Button>}{meta.page < meta.totalPages ? <Link href={href({ page: meta.page + 1 })} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Next</Link> : <Button variant="secondary" disabled>Next</Button>}</div></nav>
    </>
  );
}
