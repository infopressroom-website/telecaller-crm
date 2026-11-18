"use client";

import { useFormState } from "react-dom";
import { saveViewAction } from "@/app/actions/leads";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function SaveViewForm({ queryJson }: { queryJson: string }) {
  const [state, action] = useFormState(saveViewAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="query" value={queryJson} />
      <label className="flex flex-col gap-1 text-xs font-medium">Save current filters as a view
        <input name="name" required maxLength={60} placeholder="e.g. Hot leads this week" className="h-11 w-56 rounded-lg border border-slate-300 px-3 text-sm" />
      </label>
      <div className="w-24"><SubmitButton>Save</SubmitButton></div>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
