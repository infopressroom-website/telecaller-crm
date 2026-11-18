import type { Metadata } from "next";
import Link from "next/link";
import { deleteAutomationAction, runAutomationNowAction, testAutomationAction, toggleAutomationAction } from "@/app/actions/automation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ActionButton } from "@/features/settings/action-button";
import { TestRuleButton } from "@/features/automation/test-button";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { TRIGGER_INFO } from "@/lib/automation/rules";
import { describeActions, getSchedulerStatus, listLogs, listRules } from "@/services/automation-service";

export const metadata: Metadata = { title: "Automation" };
export const dynamic = "force-dynamic";
const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });

export default async function AutomationPage() {
  const user = await requirePagePermission("automation", "VIEW");
  const [rules, logs, sched] = await Promise.all([listRules(user), listLogs(user), getSchedulerStatus(user)]);
  const canManage = can(user, "automation", "MANAGE");
  const stale = !sched.lastRunAt || Date.now() - sched.lastRunAt.getTime() > 10 * 60_000;
  return (
    <>
      <PageHeader title="Automation" description="Trigger → condition → action. Rules run about once a minute through the scheduler."
        actions={canManage && <Link href="/automation/new" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">New rule</Link>} />
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Scheduler</h2>
            <p className="text-sm">Last run: {sched.lastRunAt ? fmt.format(sched.lastRunAt) : "never"} {stale && <Badge tone="danger">Not running</Badge>}</p>
            {!sched.cronConfigured && <p role="alert" className="mt-1 text-sm font-medium text-amber-900">CRON_SECRET is not set (24+ characters), so the automatic scheduler endpoint is disabled. Rules only run when you press “Run now”.</p>}
            <p className="mt-1 text-xs text-ink-muted">Point a scheduler at <code>POST /api/cron/automation</code> every minute (see docs/AUTOMATION.md). Running it twice never double-sends.</p>
          </div>
          {canManage && <div className="w-48"><ActionButton action={runAutomationNowAction} label="Run all rules now" tone="primary" /></div>}
        </div>
      </Card>

      {rules.length === 0 ? <Card><EmptyState title="No rules yet" description="Create a rule, test it, then turn it on." /></Card> : (
        <div className="flex flex-col gap-3">
          {rules.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{r.name} <Badge tone={r.isEnabled ? "success" : "neutral"}>{r.isEnabled ? "On" : "Off"}</Badge></h2>
                  <p className="text-sm"><span className="font-medium">When:</span> {TRIGGER_INFO[r.trigger].label}{r.conditions.threshold ? ` (${r.conditions.threshold} ${TRIGGER_INFO[r.trigger].threshold?.unit ?? ""})` : ""}</p>
                  <p className="text-sm"><span className="font-medium">Then:</span> {describeActions(r.actions) || "—"}</p>
                  <p className="text-xs text-ink-muted">Last 7 days: {r.done} done, {r.failed} failed</p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-start gap-2">
                    <TestRuleButton action={testAutomationAction} id={r.id} />
                    <Link href={`/automation/${r.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">Edit</Link>
                    <form action={toggleAutomationAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="enabled" value={String(!r.isEnabled)} /><button type="submit" className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold">{r.isEnabled ? "Turn off" : "Turn on"}</button></form>
                    <form action={deleteAutomationAction}><input type="hidden" name="id" value={r.id} /><button type="submit" className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-red-800">Delete</button></form>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <h2 className="mb-2 text-base font-semibold">Recent activity</h2>
        {logs.length === 0 ? <EmptyState title="Nothing has run yet" /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><Badge tone={l.status === "DONE" ? "success" : l.status === "FAILED" ? "danger" : "neutral"}>{l.status.toLowerCase()}</Badge> {l.ruleName} · {l.entityType}{l.error ? ` · ${l.error}` : ""}</span>
                <time className="text-xs text-ink-muted" dateTime={l.updatedAt.toISOString()}>{fmt.format(l.updatedAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
