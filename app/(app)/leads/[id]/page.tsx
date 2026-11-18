import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, LEAD_STATUS_TONE } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LeadForm } from "@/features/leads/lead-form";
import { ScheduleFollowUpForm } from "@/features/followups/schedule-form";
import { MergeForm, NoteForm, StatusForm } from "@/features/leads/side-forms";
import { LeadScoreDetails } from "@/components/leads/lead-score-details";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { STATUS_LABELS } from "@/lib/leads/fields";
import { getLeadDetail, getLeadFormOptions } from "@/services/lead-service";

export const metadata: Metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const KIND_LABEL = { activity: "Activity", call: "Call", assignment: "Assignment", followup: "Follow-up" } as const;

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission("lead", "VIEW");
  let data;
  try {
    data = await getLeadDetail(user, params.id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { lead, timeline, duplicates } = data;
  const { sources, campaigns } = await getLeadFormOptions(user);
  const canEdit = can(user, "lead", "EDIT");

  return (
    <>
      <PageHeader
        title={lead.name}
        description={`${lead.leadCode} · +${lead.primaryMobile}${lead.owner ? ` · assigned to ${lead.owner.name}` : " · unassigned"}`}
        actions={<Badge tone={LEAD_STATUS_TONE[lead.status] ?? "neutral"}>{STATUS_LABELS[lead.status]}</Badge>}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {canEdit && (
            <Card>
              <h2 className="mb-3 text-base font-semibold">Details</h2>
              <LeadForm mode="edit" fullEdit={can(user, "lead", "CREATE")} sources={sources} campaigns={campaigns}
                values={{ id: lead.id, name: lead.name, primaryMobile: lead.primaryMobile, alternateMobile: lead.alternateMobile, email: lead.email, city: lead.city, state: lead.state, sourceId: lead.sourceId, campaignId: lead.campaignId, priority: lead.priority, notes: lead.notes }} />
            </Card>
          )}
          <Card>
            <h2 className="mb-3 text-base font-semibold">Timeline</h2>
            {timeline.length === 0 ? <p className="text-sm text-ink-muted">Nothing recorded yet.</p> : (
              <ol className="flex flex-col divide-y divide-slate-100">
                {timeline.map((t) => (
                  <li key={t.id} className="flex flex-col gap-0.5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{t.title}</span>
                      <time dateTime={t.at.toISOString()} className="text-xs text-ink-muted">{fmt.format(t.at)}</time>
                    </div>
                    <div className="text-xs text-ink-muted">{KIND_LABEL[t.kind]}{t.actor ? ` · ${t.actor}` : ""}{t.detail ? ` · ${t.detail}` : ""}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 text-base font-semibold">Lead Score</h2>
            <LeadScoreDetails leadId={lead.id} />
          </Card>
          {canEdit && <Card><h2 className="mb-3 text-base font-semibold">Status</h2><StatusForm leadId={lead.id} status={lead.status} /></Card>}
          {canEdit && <Card><h2 className="mb-3 text-base font-semibold">Add a note</h2><NoteForm leadId={lead.id} /></Card>}
          {can(user, "followup", "CREATE") && <Card><h2 className="mb-3 text-base font-semibold">Schedule a follow-up</h2><ScheduleFollowUpForm leadId={lead.id} /></Card>}
          {duplicates.length > 0 && (
            <Card>
              <h2 className="mb-1 text-base font-semibold">Same mobile number</h2>
              <p className="mb-3 text-xs text-ink-muted">Other leads with this number that you can access.</p>
              <ul className="flex flex-col gap-3 text-sm">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <Link href={`/leads/${d.id}`} className="font-medium text-brand-700 underline">{d.name} ({d.leadCode})</Link>
                    <span className="ml-2 text-xs text-ink-muted">{STATUS_LABELS[d.status]}</span>
                    {can(user, "lead", "MANAGE") && <MergeForm targetId={lead.id} sourceId={d.id} label={`Merge ${d.leadCode} into ${lead.leadCode}`} />}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
