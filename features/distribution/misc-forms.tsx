"use client";

import { useFormState } from "react-dom";
import { decideRequestAction, saveAgentAction, saveSettingsAction } from "@/app/actions/distribution";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

const input = "h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm";

export function SettingsForm({ hours, canEdit }: { hours: number; canEdit: boolean }) {
  const [state, action] = useFormState(saveSettingsAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">Flag a lead as unworked after (hours)
        <input name="unworkedAfterHours" type="number" min={1} max={168} defaultValue={hours} disabled={!canEdit} className={`${input} w-32`} />
      </label>
      {canEdit && <div className="w-28"><SubmitButton>Save</SubmitButton></div>}
      <FormMessage error={state?.error ?? state?.fieldErrors?.unworkedAfterHours?.[0]} success={state?.success} />
    </form>
  );
}

export function AgentRow({
  agent, canEdit,
}: { agent: { id: string; name: string; team: string | null; assignmentPaused: boolean; maxActiveLeads: number | null; dailyLeadLimit: number | null; serviceCities: string[]; serviceStates: string[]; activeLeads: number; assignedToday: number; attendance: string | null }; canEdit: boolean }) {
  const [state, action] = useFormState(saveAgentAction, undefined);
  const away = agent.attendance === "ABSENT" || agent.attendance === "ON_LEAVE" || agent.attendance === "HOLIDAY";
  return (
    <form action={action} className="grid gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-6">
      <input type="hidden" name="userId" value={agent.id} />
      <div className="md:col-span-2">
        <p className="font-semibold">{agent.name}</p>
        <p className="text-xs text-ink-muted">{agent.team ?? "No team"} · {agent.activeLeads} open · {agent.assignedToday} assigned today</p>
        {away && <p className="mt-1 text-xs font-semibold text-amber-900">Not available today ({agent.attendance?.toLowerCase().replace("_", " ")})</p>}
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium">Max open leads
        <input name="maxActiveLeads" type="number" min={1} defaultValue={agent.maxActiveLeads ?? ""} disabled={!canEdit} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">Max per day
        <input name="dailyLeadLimit" type="number" min={1} defaultValue={agent.dailyLeadLimit ?? ""} disabled={!canEdit} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">Service cities
        <input name="serviceCities" defaultValue={agent.serviceCities.join(", ")} disabled={!canEdit} className={input} placeholder="Delhi, Pune" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">Service states
        <input name="serviceStates" defaultValue={agent.serviceStates.join(", ")} disabled={!canEdit} className={input} placeholder="Maharashtra" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="assignmentPaused" defaultChecked={agent.assignmentPaused} disabled={!canEdit} className="h-5 w-5" /> Pause new assignments</label>
      {canEdit && <div className="md:col-span-1"><SubmitButton>Save</SubmitButton></div>}
      <div className="md:col-span-3"><FormMessage error={state?.error} success={state?.success} /></div>
    </form>
  );
}

export function DecisionForm({ id }: { id: string }) {
  const [state, action] = useFormState(decideRequestAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-xs font-medium">Note (optional)
        <input name="note" maxLength={500} className={`${input} w-56`} />
      </label>
      <button type="submit" name="decision" value="approve" className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white">Approve</button>
      <button type="submit" name="decision" value="reject" className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold">Reject</button>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
