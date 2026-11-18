import type { Metadata } from "next";
import { deleteTargetAction } from "@/app/actions/performance";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TargetForm } from "@/features/performance/forms";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { METRIC_LABELS, listTargets } from "@/services/performance-service";

export const metadata: Metadata = { title: "Targets" };
export const dynamic = "force-dynamic";
const d = (x: Date) => x.toISOString().slice(0, 10);

export default async function TargetsPage() {
  const user = await requirePagePermission("performance", "VIEW");
  const { targets, people, teams } = await listTargets(user);
  const canEdit = can(user, "performance", "EDIT");
  return (
    <>
      <PageHeader title="Targets" description="Progress is for the current day, week (Mon–Sun) or month in India time." />
      {canEdit && <Card><h2 className="mb-3 text-base font-semibold">Add a target</h2><TargetForm people={people} teams={teams} /></Card>}
      <Card>
        {targets.length === 0 ? <EmptyState title="No targets set" /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {targets.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div><p className="font-medium">{t.subject}: {METRIC_LABELS[t.metric]}, {t.period.toLowerCase()} target {t.value}</p><p className="text-xs text-ink-muted">From {d(t.startsOn)}{t.endsOn ? ` to ${d(t.endsOn)}` : ""}</p></div>
                <div className="flex items-center gap-3">
                  {t.active ? <span className="tabular-nums">{t.current} / {t.value} <Badge tone={(t.achievement ?? 0) >= 100 ? "success" : "info"}>{t.achievement ?? 0}%</Badge></span> : <Badge tone="neutral">not active now</Badge>}
                  {canEdit && <form action={deleteTargetAction}><input type="hidden" name="id" value={t.id} /><button type="submit" className="min-h-11 text-sm text-red-800 underline">Remove</button></form>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
