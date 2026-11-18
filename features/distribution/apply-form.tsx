"use client";

import { useFormState } from "react-dom";
import { applyDistributionAction } from "@/app/actions/distribution";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function ApplyForm({ runId, mode, count }: { runId: string; mode: "UNASSIGNED" | "ABSENT_OWNERS"; count: number }) {
  const [state, action] = useFormState(applyDistributionAction, undefined);
  const s = state?.summary;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="mode" value={mode} />
      <FormMessage error={state?.error} success={state?.success} />
      {s && (
        <div className="rounded-lg border border-line bg-white p-3 text-sm">
          <p className="font-semibold">{s.assigned} assigned, {s.unallocated} not assigned</p>
          {s.byAgent.length > 0 && <p className="mt-1 text-ink-muted">{s.byAgent.map((a) => `${a.name}: ${a.count}`).join(" · ")}</p>}
          {s.reasons.length > 0 && <ul className="mt-1 list-disc pl-5 text-ink-muted">{s.reasons.map((r) => <li key={r.reason}>{r.count} × {r.reason}</li>)}</ul>}
        </div>
      )}
      {!s && (
        <div className="md:w-72">
          <SubmitButton>{`Apply this distribution (${count} lead${count === 1 ? "" : "s"})`}</SubmitButton>
        </div>
      )}
      <p className="text-xs text-ink-muted">The plan is recalculated at the moment you apply, so the final result can differ slightly from this preview if things changed meanwhile.</p>
    </form>
  );
}
