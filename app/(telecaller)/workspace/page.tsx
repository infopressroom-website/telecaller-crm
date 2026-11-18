import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { getWorkspaceHome } from "@/services/workspace-service";

export const metadata: Metadata = { title: "My Workspace" };
export const dynamic = "force-dynamic";

const time = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const Tile = ({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) => (
  <Card>
    <p className="text-sm font-medium text-ink-muted">{label}</p>
    <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
    {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    {href && <Link href={href} className="text-xs text-brand-700 underline">View</Link>}
  </Card>
);

export default async function WorkspacePage({ searchParams }: { searchParams: { empty?: string } }) {
  const user = await requirePagePermission("lead", "VIEW");
  const h = await getWorkspaceHome(user);
  const { counts: c, calls } = h;

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} description="Everything for today in one place."
        actions={h.eligible > 0 && <Link href="/workspace/next" className="inline-flex min-h-12 items-center rounded-lg bg-brand px-5 text-base font-semibold text-white">Start next lead →</Link>} />
      {searchParams.empty && <p role="status" className="rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-900">You&apos;re all caught up: no more leads are ready to call right now.</p>}

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Today&apos;s call target</h2>
            <p className="text-sm text-ink-muted">
              {calls.target === null ? "No daily target has been set for you yet." : `${calls.completed} of ${calls.target} calls completed (${calls.connected} connected)`}
            </p>
          </div>
          {calls.progress !== null && <p className="text-2xl font-bold tabular-nums">{calls.progress}%</p>}
        </div>
        {calls.progress !== null && (
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={calls.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Call target progress">
            <div className="h-full bg-brand" style={{ width: `${calls.progress}%` }} />
          </div>
        )}
        {calls.target === null && <p className="mt-1 text-sm">Calls completed today: <strong>{calls.completed}</strong> ({calls.connected} connected)</p>}
      </Card>

      <section aria-label="My numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        <Tile label="My assigned leads" value={c.assigned} hint="Open leads you own" href="/leads" />
        <Tile label="New leads" value={c.newLeads} hint="Not called yet" href="/leads?status=ASSIGNED" />
        <Tile label="Today's follow-ups" value={c.followUpsToday} hint={c.followUpsOverdue ? `${c.followUpsOverdue} overdue from earlier days` : "None overdue"} />
        <Tile label="Pending leads" value={c.pending} hint="New or attempted, not yet reached" />
        <Tile label="Interested leads" value={c.interested} href="/leads?status=INTERESTED" />
        <Tile label="Converted leads" value={c.converted} hint={`${c.convertedToday} today`} href="/leads?status=CONVERTED" />
        <Tile label="Calls completed" value={calls.completed} hint="Today" />
        <Tile label="Ready to call now" value={h.eligible} hint={h.held ? `${h.held} waiting (follow-up time or cool-down)` : undefined} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-base font-semibold">Follow-ups due</h2>
          {h.followUps.length === 0 ? <EmptyState title="No follow-ups due today" /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {h.followUps.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/workspace/lead/${f.lead.id}`} className="font-medium text-brand-700 underline">{f.lead.name}</Link>
                    <p className="truncate text-xs text-ink-muted">{f.notes ?? f.lead.leadCode}</p>
                  </div>
                  <time dateTime={f.dueAt.toISOString()} className={`shrink-0 text-xs ${f.dueAt < new Date() ? "font-semibold text-red-800" : "text-ink-muted"}`}>{time.format(f.dueAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Up next</h2>
          {h.queue.length === 0 ? <EmptyState title="Nothing ready to call" description="New leads and due follow-ups will appear here." /> : (
            <ol className="divide-y divide-slate-100 text-sm">
              {h.queue.map((l, i) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span><span className="mr-2 text-ink-muted">{i + 1}.</span><Link href={`/workspace/lead/${l.id}`} className="font-medium text-brand-700 underline">{l.name}</Link></span>
                  <span className="text-xs text-ink-muted">{l.reason}{l.priority === "URGENT" || l.priority === "HIGH" ? ` · ${l.priority.toLowerCase()}` : ""}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
