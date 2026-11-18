"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState } from "react-dom";
import { saveAutomationRuleAction } from "@/app/actions/automation";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ACTION_LABELS, NOTIFY_ROLES, TRIGGERS, TRIGGER_INFO, type ActionType, type Trigger } from "@/lib/automation/rules";
import { LEAD_PRIORITIES, PRIORITY_LABELS } from "@/lib/leads/fields";

export type RuleValues = { id?: string; name?: string; trigger?: Trigger; isEnabled?: boolean; conditions?: { campaignId: string | null; minLeadPriority: string | null; threshold: number | null }; actions?: { type: ActionType; role?: string }[] };

export function AutomationRuleForm({ values = {}, campaigns }: { values?: RuleValues; campaigns: { id: string; name: string }[] }) {
  const [state, action] = useFormState(saveAutomationRuleAction, undefined);
  const [trigger, setTrigger] = useState<Trigger>(values.trigger ?? "FOLLOWUP_OVERDUE");
  const info = TRIGGER_INFO[trigger];
  const chosen = new Set((values.actions ?? []).map((a) => a.type));
  const role = (values.actions ?? []).find((a) => a.role)?.role ?? "MANAGER";
  const c = values.conditions;
  return (
    <form action={action} className="grid gap-5 md:grid-cols-2">
      {values.id && <input type="hidden" name="ruleId" value={values.id} />}
      <div className="md:col-span-2"><FormMessage error={state?.error} /></div>

      <fieldset className="grid gap-4 md:col-span-2 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">1. Name and trigger (when should it run?)</legend>
        <Field label="Rule name" name="name" defaultValue={values.name} maxLength={80} />
        <div>
          <label htmlFor="trigger" className="text-sm font-medium">When</label>
          <select id="trigger" name="trigger" value={trigger} onChange={(e) => setTrigger(e.target.value as Trigger)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
            {TRIGGERS.map((t) => <option key={t} value={t}>{TRIGGER_INFO[t].label}</option>)}
          </select>
          <p className="mt-1 text-xs text-ink-muted">{info.help}</p>
        </div>
        {info.threshold && <Field label={`${info.threshold.label} (${info.threshold.unit})`} name="threshold" type="number" required={false} defaultValue={String(c?.threshold ?? info.threshold.default)} />}
      </fieldset>

      <fieldset className="grid gap-4 md:col-span-2 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">2. Conditions (only if…) — leave blank for any</legend>
        <SelectField label="Campaign" name="campaignId" placeholder="Any campaign" defaultValue={c?.campaignId ?? ""} options={campaigns.map((x) => ({ value: x.id, label: x.name }))} />
        <SelectField label="Lead priority at least" name="minLeadPriority" placeholder="Any priority" defaultValue={c?.minLeadPriority ?? ""} options={LEAD_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
      </fieldset>

      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-sm font-semibold">3. Actions (then do…)</legend>
        <div className="grid gap-1">
          {info.allowed.map((a) => (
            <label key={a} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={`action:${a}`} defaultChecked={chosen.has(a)} className="h-5 w-5" /> {ACTION_LABELS[a]}</label>
          ))}
        </div>
        {(info.allowed.includes("NOTIFY_ROLE") || info.allowed.includes("DAILY_REPORT")) && (
          <div className="mt-2 md:w-72"><SelectField label="Role to notify" name="notifyRole" defaultValue={role} options={NOTIFY_ROLES.map((r) => ({ value: r, label: r.replace(/_/g, " ").toLowerCase() }))} /></div>
        )}
        <p className="mt-2 text-xs text-ink-muted">Notifications to a whole role leave out the customer's name. Each notification is sent once per event.</p>
      </fieldset>

      <label className="flex min-h-11 items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="isEnabled" defaultChecked={values.isEnabled} className="h-5 w-5" /> Turn this rule on now (you can test it first and enable it later)</label>
      <div className="flex items-center gap-4 md:col-span-2">
        <div className="w-44"><SubmitButton>Save rule</SubmitButton></div>
        <Link href="/automation" className="text-sm text-brand-700 underline">Cancel</Link>
      </div>
    </form>
  );
}
