import type { Metadata } from "next";
import Link from "next/link";
import { deleteViewAction } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { LeadFilters } from "@/features/leads/lead-filters";
import { LeadTable, type LeadRow } from "@/features/leads/lead-table";
import { SaveViewForm } from "@/features/leads/saved-views";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { FILTER_KEYS, parseLeadListQuery, type LeadListQuery } from "@/validations/lead";
import { getLeadFormOptions, listLeads, listSavedViews, viewToParams } from "@/services/lead-service";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

function toQuery(q: LeadListQuery, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (q[k] !== undefined && !(k === "sort" && q.sort === "created_desc")) p.set(k, String(q[k]));
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

export default async function LeadsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await requirePagePermission("lead", "VIEW");
  const q = parseLeadListQuery(searchParams);
  const [{ rows, total, meta }, options, views] = await Promise.all([listLeads(user, q), getLeadFormOptions(user), listSavedViews(user)]);

  const tableRows: LeadRow[] = rows.map((r) => ({
    id: r.id, leadCode: r.leadCode, name: r.name, primaryMobile: r.primaryMobile, city: r.city,
    status: r.status, priority: r.priority, owner: r.owner?.name ?? null, team: r.team?.name ?? null,
    source: r.source?.name ?? null, campaign: r.campaign?.name ?? null,
    nextFollowUpAt: r.nextFollowUpAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
  }));
  const isTelecaller = user.roleKey === "TELECALLER";
  const baseQs = toQuery(q);
  const link = (page: number) => `/leads?${toQuery(q, { page: String(page) })}`;
  const queryJson = JSON.stringify(Object.fromEntries(FILTER_KEYS.filter((k) => q[k] !== undefined).map((k) => [k, q[k]])));

  return (
    <>
      <PageHeader
        title={isTelecaller ? "My leads" : "Leads"}
        description={`${total.toLocaleString("en-IN")} lead${total === 1 ? "" : "s"} match your filters`}
        actions={
          <>
            {can(user, "lead", "EXPORT") && (
              <>
                <a href={`/api/leads/export?format=csv&${baseQs}`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">Export CSV</a>
                <a href={`/api/leads/export?format=xlsx&${baseQs}`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">Export Excel</a>
              </>
            )}
            {can(user, "lead", "CREATE") && (
              <>
                <Link href="/leads/import" className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">Import</Link>
                <Link href="/leads/new" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">Add lead</Link>
              </>
            )}
          </>
        }
      />

      <LeadFilters q={q} sources={options.sources} campaigns={options.campaigns} teams={options.teams} owners={options.assignable} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" aria-label="Saved views">
          {views.length > 0 && <span className="text-sm font-medium">Saved views:</span>}
          {views.map((v) => (
            <span key={v.id} className="inline-flex items-center rounded-full border border-line bg-white text-sm">
              <Link href={`/leads?${viewToParams(v.filters).toString()}`} className="px-3 py-2 font-medium text-brand-700">{v.name}</Link>
              <form action={deleteViewAction}>
                <input type="hidden" name="id" value={v.id} />
                <button type="submit" aria-label={`Delete saved view ${v.name}`} className="min-h-9 px-2 text-ink-muted hover:text-red-700">×</button>
              </form>
            </span>
          ))}
        </div>
        <SaveViewForm queryJson={queryJson} />
      </div>

      <LeadTable rows={tableRows} assignable={options.assignable.map((u) => ({ id: u.id, name: u.name, team: u.team?.name ?? null }))} canAssign={can(user, "lead", "ASSIGN")} canEdit={can(user, "lead", "EDIT")} />

      <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">Page {meta.page} of {meta.totalPages}</span>
        <div className="flex gap-2">
          {meta.page > 1 ? <Link href={link(meta.page - 1)} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Previous</Link> : <Button variant="secondary" disabled>Previous</Button>}
          {meta.page < meta.totalPages ? <Link href={link(meta.page + 1)} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Next</Link> : <Button variant="secondary" disabled>Next</Button>}
        </div>
      </nav>
    </>
  );
}
