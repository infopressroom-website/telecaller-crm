"use client";

import { useFormState } from "react-dom";
import { setAiEnabledAction } from "@/app/actions/qa";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function AiToggleForm({ enabled }: { enabled: boolean }) {
  const [state, action] = useFormState(setAiEnabledAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" name="enabled" defaultChecked={enabled} className="h-5 w-5" /> Enable AI analysis of transcripts</label>
      <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" name="ack" className="mt-1 h-5 w-5" /> I understand that transcript text is sent to the AI provider and that I am responsible for having the right to do so.</label>
      <FormMessage error={state?.error} success={state?.success} />
      <div className="md:w-48"><SubmitButton>Save</SubmitButton></div>
    </form>
  );
}
