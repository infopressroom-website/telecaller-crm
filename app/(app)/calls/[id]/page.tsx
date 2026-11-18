import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { simulateEventAction } from "@/app/actions/telephony";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getCall } from "@/services/call-service";

export const metadata: Metadata = { title: "Call" };
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-3 py-1.5 text-sm"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-medium">{v || "—"}</dd></div>;

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission("call", "VIEW");
  let data;
  try { data = await getCall(user, params.id); } catch (e) { if (e instanceof AppError && e.code === "NOT_FOUND") notFound(); throw e; }
  const { call, events, canPlayRecording } = data;
  const sandbox = call.providerName === "sandbox";
  const canSimulate = sandbox && process.env.NODE_ENV !== "production" && can(user, "settings", "MANAGE");

  return (
    <>
      <PageHeader title={`Call with ${call.lead.name}`} description={`${call.lead.leadCode} · ${call.direction === "INBOUND" ? "Inbound" : "Outbound"} · ${call.agent.name}`}
        actions={<Link href="/calls" className="inline-flex min-h-11 items-center text-sm text-brand-700 underline">All calls</Link>} />
      {sandbox && <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">SANDBOX call: no real call was placed.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <dl className="divide-y divide-slate-100">
            <Row k="Lead" v={<Link href={`/leads/${call.lead.id}`} className="text-brand-700 underline">{call.lead.name}</Link>} />
            <Row k="Agent" v={call.agent.name} />
            <Row k="Team" v={call.agent.team?.name} />
            <Row k="Status" v={<Badge tone={call.status === "COMPLETED" ? "success" : call.status === "FAILED" ? "danger" : "neutral"}>{call.status.replace(/_/g, " ").toLowerCase()}</Badge>} />
            <Row k="Provider status" v={call.externalStatus} />
            <Row k="Outcome" v={call.disposition?.label ?? "Not recorded yet"} />
            <Row k="Started" v={call.startedAt ? when.format(call.startedAt) : null} />
            <Row k="Ended" v={call.endedAt ? when.format(call.endedAt) : null} />
            <Row k="Talk time" v={call.durationSec !== null ? `${call.durationSec} s` : null} />
            <Row k="Provider" v={call.providerName === "manual" ? "Agent's own phone (logged manually)" : call.providerName} />
            <Row k="Provider call ID" v={call.providerCallId} />
          </dl>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-2 text-base font-semibold">Agent notes</h2>
            <p className="whitespace-pre-wrap text-sm">{call.notes ?? <span className="text-ink-muted">No notes.</span>}</p>
          </Card>
          <Card>
            <h2 className="mb-2 text-base font-semibold">Recording</h2>
            {call.recording ? (
              canPlayRecording ? (
                <div className="flex flex-col gap-2">
                  <audio controls preload="none" src={`/api/calls/${call.id}/recording`} className="w-full" />
                  <a href={`/api/calls/${call.id}/recording`} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 underline">Open recording in a new tab</a>
                  <p className="text-xs text-ink-muted">Access is logged.</p>
                </div>
              ) : <p className="text-sm text-ink-muted">A recording exists. Only quality and oversight roles can play it.</p>
            ) : <p className="text-sm text-ink-muted">No recording stored for this call.</p>}
          </Card>
        </div>
      </div>
      {events.length > 0 && (
        <Card>
          <h2 className="mb-2 text-base font-semibold">Provider events</h2>
          <ul className="divide-y divide-slate-100 text-sm">{events.map((e) => <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{e.eventType} <Badge tone={e.status === "FAILED" ? "danger" : "neutral"}>{e.status.toLowerCase()}</Badge>{e.note ? ` · ${e.note}` : ""}</span><time className="text-xs text-ink-muted" dateTime={e.receivedAt.toISOString()}>{when.format(e.receivedAt)}</time></li>)}</ul>
        </Card>
      )}
      {canSimulate && (
        <Card>
          <h2 className="mb-2 text-base font-semibold">Sandbox tools (development only)</h2>
          <div className="flex flex-wrap gap-2">
            {(["completed", "no-answer", "busy", "failed"] as const).map((s) => (
              <form key={s} action={simulateEventAction}><input type="hidden" name="callId" value={call.id} /><input type="hidden" name="status" value={s} /><button type="submit" className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold">Simulate “{s}” webhook</button></form>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
