"use client";

import { useFormState } from "react-dom";
import { saveDispositionAction } from "@/app/actions/telephony";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LEAD_STATUSES, STATUS_LABELS } from "@/lib/leads/fields";

export type DispositionValues = { id?: string; key?: string; label?: string; isConnected?: boolean; isFinal?: boolean; requiresFollowUp?: boolean; setsLeadStatus?: string | null; sortOrder?: number; isActive?: boolean; isSystem?: boolean };

export function DispositionForm({ v = {} }: { v?: DispositionValues }) {
  const [state, action] = useFormState(saveDispositionAction, undefined);
  const fe = (k: string) => state?.fieldErrors?.[k]?.[0];
  const box = "h-5 w-5";
  return (
    <form action={action} className="grid gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-4">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {v.id ? <p className="self-end pb-3 text-sm"><span className="text-ink-muted">Key:</span> <code>{v.key}</code>{v.isSystem && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs">built-in</span>}</p> : <Field label="Key" name="key" error={fe("key")} hint="e.g. SEND_BROCHURE" maxLength={30} />}
      <Field label="Name shown to agents" name="label" defaultValue={v.label} error={fe("label")} maxLength={40} />
      <Field label="Order" name="sortOrder" type="number" required={false} defaultValue={String(v.sortOrder ?? 100)} />
      <SelectField label="Moves the lead to status" name="setsLeadStatus" placeholder="Leave status unchanged" defaultValue={v.setsLeadStatus ?? ""} options={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="isConnected" defaultChecked={v.isConnected} className={box} /> Counts as connected</label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="isFinal" defaultChecked={v.isFinal} className={box} /> Final outcome</label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="requiresFollowUp" defaultChecked={v.requiresFollowUp} className={box} /> Requires a follow-up</label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={v.isActive ?? true} disabled={v.isSystem} className={box} /> Available to agents</label>
      <div className="md:col-span-3"><FormMessage error={state?.error} success={state?.success} /></div>
      <SubmitButton>{v.id ? "Save" : "Add outcome"}</SubmitButton>
    </form>
  );
}
