"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { saveRuleAction } from "@/app/actions/distribution";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { DISTRIBUTION_METHODS, METHOD_HELP, METHOD_LABELS } from "@/lib/distribution/engine";
import { LEAD_PRIORITIES, PRIORITY_LABELS } from "@/lib/leads/fields";

type Opt = { id: string; name: string };
export type RuleValues = {
  id?: string; name?: string; method?: string; priority?: number; campaignId?: string | null; sourceId?: string | null; minLeadPriority?: string | null;
  matchCities?: string[]; matchStates?: string[]; teamId?: string | null; agentIds?: string[]; maxActiveLeads?: number | null; dailyLimit?: number | null;
  fallbackToAny?: boolean; isActive?: boolean;
};

export function RuleForm({
  values = {}, campaigns, sources, teams, agents,
}: { values?: RuleValues; campaigns: Opt[]; sources: Opt[]; teams: Opt[]; agents: (Opt & { team: { name: string } | null })[] }) {
  const [state, action] = useFormState(saveRuleAction, undefined);
  const fe = (k: string) => state?.fieldErrors?.[k]?.[0];
  const chosen = new Set(values.agentIds ?? []);
  const checkbox = "h-5 w-5";

  return (
    <form action={action} className="grid gap-5 md:grid-cols-2">
      {values.id && <input type="hidden" name="ruleId" value={values.id} />}
      <div className="md:col-span-2"><FormMessage error={state?.error} /></div>

      <fieldset className="grid gap-4 md:col-span-2 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">1. How should leads be shared?</legend>
        <Field label="Rule name" name="name" defaultValue={values.name} error={fe("name")} maxLength={80} />
        <SelectField label="Method" name="method" required defaultValue={values.method ?? "WORKLOAD_BASED"} options={DISTRIBUTION_METHODS.map((m) => ({ value: m, label: METHOD_LABELS[m] }))} />
        <ul className="list-disc pl-5 text-xs text-ink-muted md:col-span-2">
          {DISTRIBUTION_METHODS.map((m) => <li key={m}><strong>{METHOD_LABELS[m]}:</strong> {METHOD_HELP[m]}</li>)}
        </ul>
        <Field label="Order (lower runs first)" name="priority" type="number" defaultValue={String(values.priority ?? 100)} error={fe("priority")} hint="The first active rule that matches a lead is used." />
      </fieldset>

      <fieldset className="grid gap-4 md:col-span-2 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">2. Which leads does it apply to? (leave blank for any)</legend>
        <SelectField label="Campaign" name="campaignId" placeholder="Any campaign" defaultValue={values.campaignId ?? ""} error={fe("campaignId")} options={campaigns.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField label="Source" name="sourceId" placeholder="Any source" defaultValue={values.sourceId ?? ""} options={sources.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField label="Minimum lead priority" name="minLeadPriority" placeholder="Any priority" defaultValue={values.minLeadPriority ?? ""} options={LEAD_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
        <Field label="Only these cities" name="matchCities" required={false} defaultValue={(values.matchCities ?? []).join(", ")} hint="Comma-separated, e.g. Delhi, Pune" />
        <Field label="Only these states" name="matchStates" required={false} defaultValue={(values.matchStates ?? []).join(", ")} hint="Comma-separated" />
      </fieldset>

      <fieldset className="grid gap-4 md:col-span-2 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">3. Who can receive them?</legend>
        <SelectField label="Team" name="teamId" placeholder="Any team" defaultValue={values.teamId ?? ""} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
        <div className="md:col-span-2">
          <p className="mb-1 text-sm font-medium">Specific agents {fe("agentIds") && <span role="alert" className="text-xs font-medium text-red-700"> — {fe("agentIds")}</span>}</p>
          <p className="mb-2 text-xs text-ink-muted">Leave all unticked to allow every eligible telecaller (within the team, if one is chosen). Inactive, paused and absent employees are always skipped.</p>
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-line bg-white p-2 sm:grid-cols-2">
            {agents.map((a) => (
              <label key={a.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="agentIds" value={a.id} defaultChecked={chosen.has(a.id)} className={checkbox} /> {a.name}{a.team ? ` (${a.team.name})` : ""}
              </label>
            ))}
            {agents.length === 0 && <p className="p-2 text-sm text-ink-muted">No active telecallers yet.</p>}
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 md:col-span-2 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">4. Limits</legend>
        <Field label="Max open leads per agent" name="maxActiveLeads" type="number" required={false} defaultValue={values.maxActiveLeads?.toString() ?? ""} error={fe("maxActiveLeads")} hint="The stricter of this and the agent's own limit applies." />
        <Field label="Max new leads per agent per day" name="dailyLimit" type="number" required={false} defaultValue={values.dailyLimit?.toString() ?? ""} error={fe("dailyLimit")} />
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="fallbackToAny" defaultChecked={values.fallbackToAny} className={checkbox} /> Location based: if nobody covers the lead's location, use any eligible agent</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={values.isActive ?? true} className={checkbox} /> Rule is active</label>
      </fieldset>

      <div className="flex items-center gap-4 md:col-span-2">
        <div className="w-48"><SubmitButton>Save rule</SubmitButton></div>
        <Link href="/distribution/rules" className="text-sm text-brand-700 underline">Cancel</Link>
      </div>
    </form>
  );
}
