import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DecisionForm } from "@/features/distribution/misc-forms";
import { DistributionNav } from "@/features/distribution/subnav";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { listApprovals } from "@/services/distribution-service";

export const metadata: Metadata = { title: "Reassignment approvals" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function ApprovalsPage() {
  const user = await requirePagePermission("distribution", "VIEW");
  const { pending, recent } = await listApprovals(user);
  const canDecide = can(user, "distribution", "APPROVE");
  return (
    <>
      <PageHeader title="Reassignment approvals" description="Moving a lead that already has an owner needs approval from a manager." />
      <DistributionNav user={user} active="approvals" />
      <Card>
        <h2 className="mb-2 text-base font-semibold">Waiting for a decision</h2>
        {pending.length === 0 ? <EmptyState title="Nothing waiting" /> : (
          <ul className="divide-y divide-slate-100">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3 text-sm">
                <p><Link href={`/leads/${r.lead.id}`} className="font-medium text-brand-700 underline">{r.lead.name} ({r.lead.leadCode})</Link>: {r.fromName ?? "unassigned"} → <strong>{r.toUser.name}</strong></p>
                <p className="text-xs text-ink-muted">Requested by {r.requester.name} on {fmt.format(r.createdAt)}. Reason: {r.reason}</p>
                {canDecide ? <DecisionForm id={r.id} /> : <Badge tone="warning">Awaiting a manager</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 text-base font-semibold">Recent decisions</h2>
        {recent.length === 0 ? <EmptyState title="No decisions yet" /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map((r) => (
              <li key={r.id} className="py-2">
                <Badge tone={r.status === "APPROVED" ? "success" : "danger"}>{r.status.toLowerCase()}</Badge>{" "}
                {r.lead.name} ({r.lead.leadCode}) → {r.toUser.name}
                <span className="text-xs text-ink-muted"> · by {r.decidedByName ?? "system"}{r.decidedAt ? `, ${fmt.format(r.decidedAt)}` : ""}{r.decisionNote ? ` · ${r.decisionNote}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
