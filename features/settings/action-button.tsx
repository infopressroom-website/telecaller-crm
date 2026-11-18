"use client";

import { useFormState, useFormStatus } from "react-dom";
import { FormMessage } from "@/components/ui/form-message";
import type { FormState } from "@/app/actions/auth";

function Btn({ label, tone }: { label: string; tone: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  const cls = tone === "primary" ? "bg-brand text-white" : tone === "danger" ? "bg-red-700 text-white" : "border border-line bg-white";
  return <button type="submit" disabled={pending} aria-busy={pending} className={`min-h-11 rounded-lg px-4 text-sm font-semibold disabled:opacity-50 ${cls}`}>{pending ? "Working…" : label}</button>;
}

/** A button that runs a server action with no fields and shows its result. */
export function ActionButton({
  action, label, tone = "secondary",
}: { action: (prev: FormState, fd: FormData) => Promise<FormState>; label: string; tone?: "primary" | "secondary" | "danger" }) {
  const [state, run] = useFormState(action, undefined);
  return (
    <form action={run} className="flex flex-col gap-2">
      <div><Btn label={label} tone={tone} /></div>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
