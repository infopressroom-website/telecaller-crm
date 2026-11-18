import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ApplyForm } from "@/features/distribution/apply-form";
import { DistributionNav } from "@/features/distribution/subnav";
import { SettingsForm } from "@/features/distribution/misc-forms";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getOverview, listRuns, previewDistribution, type Mode } from "@/services/distribution-service";

export const metadata: Metadata = { title: "Lead distribution" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const Stat = ({ label, value, href }: { label: string; value: number; href?: string }) => (
  <Card>
    <p className="text-sm font-medium text-ink-muted">{label}</p>
    <p className="mt-1 text-3xl font-bold">{value.toLocaleString("en-IN")}</p>
    {href && <Link href={href} className="text-xs text-brand-700 underline">View</Link>}
  </Card>
);

export default async function DistributionPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await requirePagePermission("distribution", "VIEW");
  const canRun = can(user, "distribution", "ASSIGN");
  const canAbsent = can(user, "distribution", "APPROVE");
  const mode: Mode = searchParams.mode === "ABSENT_OWNERS" && canAbsent ? "ABSENT_OWNERS" : "UNASSIGNED";

  const [overview, runs] = await Promise.all([getOverview(user), listRuns(user)]);
  let preview, previewError;
  if (canRun && searchParams.preview === "1") {
    try { preview = await previewDistribution(user, mode); } catch (e) { previewError = e instanceof AppError ? e.message : "Could not build the preview."; }
  }

  return (
    <>
      <PageHeader title="Lead distribution" description="Share new leads fairly using your rules. Always preview before applying." />
      <DistributionNav user={user} active="overview" />

      <section aria-label="Overview" className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Stat label="Unassigned new leads" value={overview.unassigned} href="/leads?status=NEW&ownerId=unassigned" />
        <Stat label="Eligible agents" value={overview.eligibleAgents} href="/distribution/agents" />
        <Stat label="Active rules" value={overview.activeRules} href="/distribution/rules" />
        <Stat label="Pending approvals" value={overview.pendingApprovals} href="/distribution/approvals" />
        <Stat label={`Unworked > ${overview.unworkedAfterHours}h`} value={overview.unworkedTotal} href="/leads?work=unworked" />
      </section>

      {canRun && (
        <Card>
          <h2 className="mb-3 text-base font-semibold">Run distribution</h2>
          <form method="get" action="/distribution" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="preview" value="1" />
            <label className="flex flex-col gap-1 text-sm font-medium">Which leads?
              <select name="mode" defaultValue={mode} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                <option value="UNASSIGNED">New leads with no owner</option>
                {canAbsent && <option value="ABSENT_OWNERS">Unworked leads of absent employees (reassign)</option>}
              </select>
            </label>
            <button type="submit" className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white">Preview</button>
          </form>

          {previewError && <p role="alert" className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-900">{previewError}</p>}
          {preview && (
            <div className="mt-4 flex flex-col gap-4">
              {preview.totalLeads === 0 ? (
                <EmptyState title="Nothing to distribute" description={mode === "ABSENT_OWNERS" ? "No unworked leads belong to absent employees today (absence comes from attendance records)." : "There are no unassigned new leads in your area."} />
              ) : (
                <>
                  <p className="text-sm"><strong>{preview.assigned}</strong> of {preview.totalLeads} leads would be assigned, <strong>{preview.unallocated}</strong> would stay unassigned. {preview.agentCount} eligible agents, {preview.ruleCount} active rules.{preview.capped && " Only the first 2,000 leads are included; run again for the rest."}</p>
                  {preview.byAgent.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead><tr className="border-b border-line text-ink-muted">{["Agent", "Would receive", "Open leads now", "Open leads after"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
                        <tbody>{preview.byAgent.map((a) => <tr key={a.id} className="border-b border-slate-100"><td className="px-3 py-2">{a.name}</td><td className="px-3 py-2 font-semibold">{a.assigned}</td><td className="px-3 py-2">{a.before}</td><td className="px-3 py-2">{a.after}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                  {preview.reasons.length > 0 && (
                    <div><p className="mb-1 text-sm font-semibold">Why some leads would not be assigned</p><ul className="list-disc pl-5 text-sm text-ink-muted">{preview.reasons.map((r) => <li key={r.reason}>{r.count} × {r.reason}</li>)}</ul></div>
                  )}
                  {preview.sample.length > 0 && (
                    <details className="text-sm"><summary className="cursor-pointer font-semibold">Sample of assignments</summary>
                      <ul className="mt-2 divide-y divide-slate-100">{preview.sample.map((s) => <li key={s.leadCode} className="py-1.5">{s.leadCode} {s.leadName} → <strong>{s.agentName}</strong> <span className="text-ink-muted">({s.ruleName})</span></li>)}</ul>
                    </details>
                  )}
                  {preview.assigned > 0 && <ApplyForm runId={randomUUID()} mode={mode} count={preview.assigned} />}
                </>
              )}
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-1 text-base font-semibold">Unworked-lead alerts</h2>
        <p className="mb-3 text-xs text-ink-muted">Leads assigned more than {overview.unworkedAfterHours} hours ago with no call logged.</p>
        {overview.unworkedByAgent.length === 0 ? <EmptyState title="No unworked leads" description="Everyone has started on their assigned leads." /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {overview.unworkedByAgent.map((u) => (
              <li key={u.ownerId ?? "none"} className="flex items-center justify-between gap-3 py-2">
                <span>{u.name}</span>
                <Link href={`/leads?work=unworked&ownerId=${u.ownerId ?? ""}`} className="font-semibold text-brand-700 underline">{u.count} lead{u.count === 1 ? "" : "s"}</Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-slate-100 pt-3"><SettingsForm hours={overview.unworkedAfterHours} canEdit={can(user, "distribution", "MANAGE")} /></div>
      </Card>

      <Card>
        <h2 className="mb-2 text-base font-semibold">Recent runs</h2>
        {runs.length === 0 ? <EmptyState title="No runs yet" /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{r.actor} · {r.mode === "UNASSIGNED" ? "new leads" : "absent owners"}</span>
                <span className="text-ink-muted">{r.assigned} assigned, {r.unallocated} not · {fmt.format(r.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
