import type { Metadata } from "next";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { BonusForm, DecisionButtons, GenerateForm, SlabForm } from "@/features/performance/forms";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { rupees } from "@/lib/performance/incentive";
import { getIncentiveSettings, listSlabs, listStatements } from "@/services/incentive-service";

export const metadata: Metadata = { title: "Incentives" };
export const dynamic = "force-dynamic";
const TONE: Record<string, BadgeTone> = { PENDING_APPROVAL: "warning", APPROVED: "info", PAID: "success", REJECTED: "danger", DRAFT: "neutral" };
const d = (x: Date) => x.toISOString().slice(0, 10);

export default async function IncentivesPage() {
  const user = await requirePagePermission("incentive", "VIEW");
  const [statements, slabs, settings] = await Promise.all([listStatements(user), listSlabs(user), getIncentiveSettings()]);
  const manage = can(user, "incentive", "MANAGE"), generate = can(user, "incentive", "CREATE"), approve = can(user, "incentive", "APPROVE");
  return (
    <>
      <PageHeader title="Incentives" description="Calculated from your slabs and the same numbers shown on the performance page. Every statement shows how the amount was reached and needs a manager's approval." />
      {generate && <Card><h2 className="mb-3 text-base font-semibold">Create statements for a period</h2><GenerateForm /></Card>}
      <Card>
        <h2 className="mb-3 text-base font-semibold">Statements</h2>
        {statements.length === 0 ? <EmptyState title="No statements yet" /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {statements.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{s.user.name} · {d(s.periodStart)} to {d(s.periodEnd)}</span><span><Badge tone={TONE[s.status] ?? "neutral"}>{s.status.replace("_", " ").toLowerCase()}</Badge> <strong>{rupees(s.amountPaise)}</strong></span></div>
                {s.calc && <ul className="list-disc pl-5 text-xs text-ink-muted">{s.calc.lines.map((l, i) => <li key={i}>{l.label}{l.metric ? ` (${l.value} achieved)` : ""}: {rupees(l.amountPaise)}</li>)}</ul>}
                {s.approvedByName && <p className="text-xs text-ink-muted">Decided by {s.approvedByName}</p>}
                <DecisionButtons id={s.id} status={s.status} canDecide={approve && s.userId !== user.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      {user.roleKey !== "TELECALLER" && (
        <Card>
          <h2 className="mb-2 text-base font-semibold">Slabs</h2>
          <p className="mb-3 text-xs text-ink-muted">For each measure, the slab whose range contains the achieved value applies (the highest “from” wins if ranges overlap).</p>
          <div className="flex flex-col gap-3">{slabs.map((s) => <SlabForm key={s.id} slab={s} />)}</div>
          {manage && (<><h3 className="mb-2 mt-4 text-sm font-semibold">Add a slab</h3><SlabForm /><h3 className="mb-2 mt-4 text-sm font-semibold">Conversion bonus</h3><BonusForm rupees={settings.conversionBonusPaise / 100} /></>)}
        </Card>
      )}
    </>
  );
}
