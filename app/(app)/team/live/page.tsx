import type { Metadata } from "next";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { LIVE_LABELS, type LiveStatus } from "@/lib/team/status";
import { liveStatus } from "@/services/attendance-service";

export const metadata: Metadata = { title: "Live team status" };
export const dynamic = "force-dynamic";
const TONE: Record<LiveStatus, BadgeTone> = { AVAILABLE: "success", ON_CALL: "info", BREAK: "warning", OFFLINE: "neutral", ON_LEAVE: "neutral" };
const time = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function LivePage() {
  const user = await requirePagePermission("attendance", "VIEW");
  const rows = await liveStatus(user);
  const count = (s: LiveStatus) => rows.filter((r) => r.status === s).length;
  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader title="Live team status" description="Refreshes every 30 seconds. Based on clock-in, breaks, leave and calls in progress; browser activity is never used." />
      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {(Object.keys(LIVE_LABELS) as LiveStatus[]).map((s) => <Card key={s}><p className="text-sm text-ink-muted">{LIVE_LABELS[s]}</p><p className="text-3xl font-bold">{count(s)}</p></Card>)}
      </section>
      <Card>
        {rows.length === 0 ? <EmptyState title="No one to show" /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {rows.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span><span className="font-medium">{r.name}</span> <span className="text-xs text-ink-muted">{r.team ?? ""}</span></span><span className="flex items-center gap-2">{r.since && <span className="text-xs text-ink-muted">in since {time.format(r.since)}</span>}<Badge tone={TONE[r.status]}>{LIVE_LABELS[r.status]}</Badge></span></li>)}
          </ul>
        )}
      </Card>
    </>
  );
}
