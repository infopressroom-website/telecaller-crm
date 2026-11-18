"use client";

import { useFormState } from "react-dom";
import type { FormState } from "@/app/actions/auth";
import { FormMessage } from "@/components/ui/form-message";

export function TestRuleButton({ action, id }: { action: (p: FormState, fd: FormData) => Promise<FormState>; id: string }) {
  const [state, run] = useFormState(action, undefined);
  return (
    <form action={run} className="flex max-w-xs flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold">Test (dry run)</button>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
