"use client";

import { useFormState } from "react-dom";
import { createFollowUpAction } from "@/app/actions/followups";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function ScheduleFollowUpForm({ leadId }: { leadId: string }) {
  const [state, action] = useFormState(createFollowUpAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="flex flex-col gap-1 text-sm font-medium">Date and time (India time)
        <input type="datetime-local" name="dueLocal" required className="h-11 rounded-lg border border-slate-300 px-3 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">What to do <span className="font-normal text-ink-muted">(optional)</span>
        <input name="notes" maxLength={300} className="h-11 rounded-lg border border-slate-300 px-3 text-sm" />
      </label>
      <FormMessage error={state?.error} success={state?.success} />
      <SubmitButton>Schedule follow-up</SubmitButton>
    </form>
  );
}
