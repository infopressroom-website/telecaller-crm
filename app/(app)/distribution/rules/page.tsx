import type { Metadata } from "next";
import Link from "next/link";
import { archiveRuleAction, toggleRuleAction } from "@/app/actions/distribution";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DistributionNav } from "@/features/distribution/subnav";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { METHOD_LABELS, type DistributionMethod } from "@/lib/distribution/engine";
import { listRules } from "@/services/distribution-service";

export const metadata: Metadata = { title: "Distribution rules" };
export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const user = await requirePagePermission("distribution", "VIEW");
  const rules = await listRules(user);
  const canManage = can(user, "distribution", "MANAGE");
  const bits = (r: (typeof rules)[number]) => [
    r.campaignName && `Campaign: ${r.campaignName}`, r.sourceName && `Source: ${r.sourceName}`, r.minLeadPriority && `Priority ≥ ${r.minLeadPriority.toLowerCase()}`,
    r.matchCities.length > 0 && `Cities: ${r.matchCities.join(", ")}`, r.matchStates.length > 0 && `States: ${r.matchStates.join(", ")}`,
  ].filter(Boolean).join(" · ") || "Any lead";
  return (
    <>
      <PageHeader title="Distribution rules" description="The first active rule (lowest order number) that matches a lead decides how it is shared."
        actions={canManage && <Link href="/distribution/rules/new" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">New rule</Link>} />
      <DistributionNav user={user} active="rules" />
      {rules.length === 0 ? <Card><EmptyState title="No rules yet" description={canManage ? "Create a rule so leads can be distributed automatically." : "An administrator needs to create rules."} /></Card> : (
        <div className="flex flex-col gap-3">
          {rules.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{r.name} <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Off"}</Badge></h2>
                  <p className="text-sm text-ink-muted">Order {r.priority} · {METHOD_LABELS[r.method as DistributionMethod]}</p>
                  <p className="mt-1 text-sm"><span className="font-medium">Applies to:</span> {bits(r)}</p>
                  <p className="text-sm"><span className="font-medium">Pool:</span> {r.agentIds.length ? `${r.agentIds.length} chosen agent${r.agentIds.length === 1 ? "" : "s"}` : "all eligible telecallers"}{r.teamName ? ` in ${r.teamName}` : ""}</p>
                  <p className="text-sm"><span className="font-medium">Limits:</span> {r.maxActiveLeads ? `${r.maxActiveLeads} open per agent` : "no open-lead cap"}{r.dailyLimit ? ` · ${r.dailyLimit} per day` : ""}</p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/distribution/rules/${r.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">Edit</Link>
                    <form action={toggleRuleAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="isActive" value={String(!r.isActive)} /><button type="submit" className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold">{r.isActive ? "Turn off" : "Turn on"}</button></form>
                    <form action={archiveRuleAction}><input type="hidden" name="id" value={r.id} /><button type="submit" className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-red-800">Delete</button></form>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
