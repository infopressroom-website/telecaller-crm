import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/features/dashboard/filter-bar";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { parseDashboardFilters } from "@/lib/dashboard-filters";
import { db } from "@/lib/db";
import { getAgentStats, getMyQaFeedback } from "@/services/performance-service";

export const metadata: Metadata = { title: "Performance" };
export const dynamic = "force-dynamic";
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const talk = (s: number | null) => (s === null ? "—" : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);
const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export default async function PerformancePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await requirePagePermission("performance", "VIEW");
  const filters = parseDashboardFilters(searchParams);
  const own = user.roleKey === "TELECALLER";
  const [{ rows, comparesTargets }, teams, feedback] = await Promise.all([
    getAgentStats(user, filters), own ? [] : db.team.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }), own ? getMyQaFeedback(user) : [],
  ]);
  return (
    <>
      <PageHeader title={own ? "My performance" : "Performance"} description={`Showing: ${filters.range.label} (India time). Ordered by conversions, never by call volume alone.`}
        actions={<>{can(user, "performance", "VIEW") && <Link href="/performance/targets" className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">Targets</Link>}{can(user, "incentive", "VIEW") && <Link href="/performance/incentives" className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">Incentives</Link>}</>} />
      {!own && <FilterBar filters={filters} options={{ teams, campaigns: [] }} action="/performance" />}
      {filters.notice && <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">{filters.notice}</p>}
      <Card>
        {rows.length === 0 ? <EmptyState title="No telecallers to show" /> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr className="border-b border-line text-ink-muted">{["Telecaller", "Calls", "Connected", "Connect rate", "Interested", "Follow-ups done", "Conversions", "Conv. rate", "Avg talk", "QA score", comparesTargets ? "Call target" : ""].filter(Boolean).map((h) => <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100"><td className="px-3 py-2 font-medium">{r.name}<div className="text-xs font-normal text-ink-muted">{r.team ?? ""}</div></td>
                <td className="px-3 py-2">{r.attempts}</td><td className="px-3 py-2">{r.connected}</td><td className="px-3 py-2">{pct(r.connectRate)}</td><td className="px-3 py-2">{r.interested}</td><td className="px-3 py-2">{r.followUps}</td><td className="px-3 py-2 font-semibold">{r.conversions}</td><td className="px-3 py-2">{pct(r.conversionRate)}</td><td className="px-3 py-2">{talk(r.avgTalkSec)}</td><td className="px-3 py-2">{r.qaScore === null ? "—" : `${r.qaScore} (${r.qaReviews})`}</td>
                {comparesTargets && <td className="px-3 py-2">{r.targetValue ? `${pct(r.targetAchievement)} of ${r.targetValue}` : "No target"}</td>}</tr>))}</tbody>
          </table></div>
        )}
      </Card>
      {own && feedback.length > 0 && (
        <Card><h2 className="mb-2 text-base font-semibold">Feedback on my calls</h2>
          <ul className="divide-y divide-slate-100 text-sm">{feedback.map((f) => <li key={f.id} className="py-2"><p className="font-medium">{f.score ?? "—"}% · {when.format(f.createdAt)} · {f.reviewer.name}</p>{f.feedback && <p>{f.feedback}</p>}{f.coachingNotes && <p className="text-ink-muted">Coaching: {f.coachingNotes}</p>}</li>)}</ul></Card>
      )}
      <details className="rounded-card border border-line bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold">How these numbers are calculated</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
          <li><strong>Calls / connected:</strong> call records created in the period; connected = outcome marked “connected”.</li>
          <li><strong>Interested / conversions:</strong> distinct leads with that outcome (or, for conversions, a status change to Converted made by the telecaller) in the period.</li>
          <li><strong>Conv. rate:</strong> conversions ÷ connected calls.</li>
          <li><strong>Avg talk:</strong> average talk time of connected calls that have a duration.</li>
          <li><strong>QA score:</strong> average of QA reviews in the period (number of reviews in brackets).</li>
          <li><strong>Call target:</strong> only shown for Today / Yesterday (daily target), Last 7 days (weekly target) and This month (monthly target); the last-7-days comparison is approximate because weekly targets run Monday–Sunday.</li>
        </ul></details>
    </>
  );
}
