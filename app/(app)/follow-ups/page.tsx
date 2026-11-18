import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { FollowUpActions } from "@/features/followups/follow-up-actions";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { PRIORITY_LABELS, type LeadPriorityValue } from "@/lib/leads/fields";
import { FOLLOWUP_VIEWS, VIEW_LABELS, listFollowUps, type FollowUpView } from "@/services/followup-service";

export const metadata: Metadata = { title: "Follow-ups" };
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function FollowUpsPage({ searchParams }: { searchParams: { view?: string; scope?: string; page?: string } }) {
  const user = await requirePagePermission("followup", "VIEW");
  const isTelecaller = user.roleKey === "TELECALLER";
  const view = (FOLLOWUP_VIEWS as readonly string[]).includes(searchParams.view ?? "") ? (searchParams.view as FollowUpView) : "today";
  const mine = isTelecaller || searchParams.scope !== "team";
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const { rows, meta, counts, now } = await listFollowUps(user, { view, mine, page, pageSize: 25 });
  const canEdit = can(user, "followup", "EDIT");
  const href = (o: { view?: string; scope?: string; page?: number }) => `/follow-ups?view=${o.view ?? view}&scope=${o.scope ?? (mine ? "mine" : "team")}&page=${o.page ?? 1}`;

  return (
    <>
      <PageHeader title={isTelecaller ? "My follow-ups" : mine ? "My follow-ups" : "Team follow-ups"} description="Promises made to customers. Overdue means still pending from an earlier day." />
      {!isTelecaller && (
        <div className="flex gap-2" role="group" aria-label="Whose follow-ups">
          {[["mine", "My follow-ups"], ["team", "Team follow-ups"]].map(([k, l]) => (
            <Link key={k} href={href({ scope: k })} aria-current={(k === "mine") === mine ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold ${(k === "mine") === mine ? "bg-brand text-white" : "border border-line bg-white"}`}>{l}</Link>
          ))}
        </div>
      )}
      <nav aria-label="Follow-up views" className="flex flex-wrap gap-2">
        {FOLLOWUP_VIEWS.map((v) => (
          <Link key={v} href={href({ view: v })} aria-current={v === view ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${v === view ? "bg-navy-900 text-white" : "border border-line bg-white"}`}>
            {VIEW_LABELS[v]} <span className={`rounded-full px-2 text-xs ${v === view ? "bg-white/20" : v === "overdue" && counts[v] > 0 ? "bg-red-100 text-red-900" : "bg-slate-100"}`}>{counts[v]}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? <EmptyState title={`No ${VIEW_LABELS[view].toLowerCase()} follow-ups`} /> : (
        <ul className="flex flex-col gap-3">
          {rows.map((f) => {
            const late = f.status === "PENDING" && f.dueAt < now;
            return (
              <li key={f.id} className="flex flex-col gap-2 rounded-card border border-line bg-white p-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold"><Link href={isTelecaller ? `/workspace/lead/${f.lead.id}` : `/leads/${f.lead.id}`} className="text-brand-700 underline">{f.lead.name}</Link> <span className="text-xs font-normal text-ink-muted">{f.lead.leadCode} · +{f.lead.primaryMobile}</span></p>
                  <p className="text-sm"><time dateTime={f.dueAt.toISOString()} className={late ? "font-semibold text-red-800" : ""}>{when.format(f.dueAt)}</time> {late && <Badge tone="danger">Late</Badge>} <Badge tone="neutral">{PRIORITY_LABELS[f.priority as LeadPriorityValue]}</Badge></p>
                  <p className="text-xs text-ink-muted">Owner: {f.owner.name}{f.notes ? ` · ${f.notes}` : ""}{f.completedAt ? ` · done ${when.format(f.completedAt)}` : ""}</p>
                </div>
                {canEdit && f.status === "PENDING" && <FollowUpActions id={f.id} />}
              </li>
            );
          })}
        </ul>
      )}
      <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">Page {meta.page} of {meta.totalPages}</span>
        <div className="flex gap-2">
          {meta.page > 1 ? <Link href={href({ page: meta.page - 1 })} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Previous</Link> : <Button variant="secondary" disabled>Previous</Button>}
          {meta.page < meta.totalPages ? <Link href={href({ page: meta.page + 1 })} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Next</Link> : <Button variant="secondary" disabled>Next</Button>}
        </div>
      </nav>
    </>
  );
}
