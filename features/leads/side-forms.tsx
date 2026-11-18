"use client";

import { useFormState } from "react-dom";
import { addNoteAction, changeStatusAction, mergeLeadsAction } from "@/app/actions/leads";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextAreaField } from "@/components/ui/textarea-field";
import { LEAD_STATUSES, STATUS_LABELS } from "@/lib/leads/fields";

export function StatusForm({ leadId, status }: { leadId: string; status: string }) {
  const [state, action] = useFormState(changeStatusAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <SelectField label="Status" name="status" defaultValue={status} options={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
      <FormMessage error={state?.error} success={state?.success} />
      <SubmitButton>Update status</SubmitButton>
    </form>
  );
}

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, action] = useFormState(addNoteAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <TextAreaField label="Internal note" name="message" required error={state?.fieldErrors?.message?.[0]} />
      <FormMessage error={state?.error} success={state?.success} />
      <SubmitButton>Add note</SubmitButton>
    </form>
  );
}

export function MergeForm({ targetId, sourceId, label }: { targetId: string; sourceId: string; label: string }) {
  const [state, action] = useFormState(mergeLeadsAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <p className="text-sm font-medium">{label}</p>
      <label className="flex min-h-11 items-center gap-2 text-xs">
        <input type="checkbox" name="confirm" className="h-5 w-5" /> Move its calls, notes and follow-ups here and archive it
      </label>
      <FormMessage error={state?.error} success={state?.success} />
      <SubmitButton>Merge into this lead</SubmitButton>
    </form>
  );
}
