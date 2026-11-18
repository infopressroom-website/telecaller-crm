import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, LEAD_STATUS_TONE } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CallPanel } from "@/features/workspace/call-panel";
import { requirePagePermission } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/leads/fields";
import { skipListSchema } from "@/validations/workspace";
import { getWorkspaceLead } from "@/services/workspace-service";

export const metadata: Metadata = { title: "Lead workspace" };
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3 py-1.5 text-sm"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-medium">{v || "—"}</dd></div>
);

export default async function WorkspaceLeadPage({ params, searchParams }: { params: { id: string }; searchParams: { skip?: string } }) {
  const user = await requirePagePermission("lead", "VIEW");
  let data;
  try {
    data = await getWorkspaceLead(user, params.id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound(); // someone else's lead looks like it doesn't exist
    throw e;
  }
  const { lead, dispositions, calls, followUps, activeCall, timeline } = data;
  const skip = [...skipListSchema.parse(searchParams.skip), lead.id];
  const nextHref = `/workspace/next?skip=${encodeURIComponent(skip.join(","))}`;
  const blocked = lead.status === "DND" ? "This customer is marked Do Not Disturb. Don't call; ask a manager to review the lead." : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{lead.name}</h1>
              <p className="text-xs text-ink-muted">{lead.leadCode}</p>
            </div>
            <Badge tone={LEAD_STATUS_TONE[lead.status] ?? "neutral"}>{STATUS_LABELS[lead.status]}</Badge>
          </div>
          <a href={`tel:+${lead.primaryMobile}`} className="mt-3 block text-3xl font-bold tabular-nums text-brand-700">+{lead.primaryMobile}</a>
          {lead.alternateMobile && <p className="text-sm text-ink-muted">Alternate: <a className="underline" href={`tel:+${lead.alternateMobile}`}>+{lead.alternateMobile}</a></p>}
          <dl className="mt-3 divide-y divide-slate-100">
            <Row k="Source" v={lead.source?.name} />
            <Row k="Campaign" v={lead.campaign?.name} />
            <Row k="Location" v={[lead.city, lead.state].filter(Boolean).join(", ")} />
            <Row k="Email" v={lead.email} />
            <Row k="Priority" v={PRIORITY_LABELS[lead.priority]} />
            <Row k="Next follow-up" v={lead.nextFollowUpAt ? when.format(lead.nextFollowUpAt) : null} />
          </dl>
          {lead.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><span className="font-semibold">About this lead: </span>{lead.notes}</p>}
          {followUps.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><span className="font-semibold">Promised follow-up: </span>{when.format(followUps[0]!.dueAt)}{followUps[0]!.notes ? ` — ${followUps[0]!.notes}` : ""}</p>}
        </Card>

        <Card>
          <h2 className="mb-2 text-base font-semibold">Previous call notes</h2>
          {calls.length === 0 ? <p className="text-sm text-ink-muted">No calls recorded yet. This is a fresh lead.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {calls.map((c) => (
                <li key={c.id} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{c.disposition?.label}</span><time dateTime={c.createdAt.toISOString()} className="text-xs text-ink-muted">{when.format(c.createdAt)}</time></div>
                  <p className="text-xs text-ink-muted">{c.agent.name}{c.durationSec ? ` · ${Math.floor(c.durationSec / 60)}m ${c.durationSec % 60}s` : ""}</p>
                  {c.notes && <p className="mt-1">{c.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-3">
        <CallPanel leadId={lead.id} leadName={lead.name} phone={lead.primaryMobile} dispositions={dispositions} activeCall={activeCall} nextHref={nextHref} blockedReason={blocked} telephonyMode={data.telephonyMode} />
        <Card>
          <h2 className="mb-2 text-base font-semibold">Recent activity</h2>
          {timeline.length === 0 ? <p className="text-sm text-ink-muted">Nothing yet.</p> : (
            <ol className="divide-y divide-slate-100 text-sm">
              {timeline.slice(0, 8).map((t) => (
                <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{t.title}{t.detail ? <span className="text-ink-muted"> · {t.detail}</span> : null}</span><time dateTime={t.at.toISOString()} className="text-xs text-ink-muted">{when.format(t.at)}</time></li>
              ))}
            </ol>
          )}
          <Link href="/workspace" className="mt-3 inline-block text-sm text-brand-700 underline">Back to my workspace</Link>
        </Card>
      </div>
    </div>
  );
}
