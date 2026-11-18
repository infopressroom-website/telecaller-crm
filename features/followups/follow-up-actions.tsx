"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { completeFollowUpAction, rescheduleFollowUpAction } from "@/app/actions/followups";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

const input = "h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm";

export function FollowUpActions({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [done, doneAction] = useFormState(completeFollowUpAction, undefined);
  const [moved, moveAction] = useFormState(rescheduleFollowUpAction, undefined);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={doneAction}><input type="hidden" name="id" value={id} /><button type="submit" className="min-h-11 rounded-lg bg-brand px-3 text-sm font-semibold text-white">Mark done</button></form>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold">Reschedule</button>
      </div>
      <FormMessage error={done?.error} success={done?.success} />
      {open && (
        <form action={moveAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-2">
          <input type="hidden" name="id" value={id} />
          <label className="flex flex-col gap-1 text-xs font-medium">New date and time (India time)<input type="datetime-local" name="dueLocal" required className={input} /></label>
          <label className="flex flex-col gap-1 text-xs font-medium">Reason<input name="reason" maxLength={200} className={`${input} w-48`} /></label>
          <div className="w-28"><SubmitButton>Move</SubmitButton></div>
          <FormMessage error={moved?.error} success={moved?.success} />
        </form>
      )}
    </div>
  );
}
