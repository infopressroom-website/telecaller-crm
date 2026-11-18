"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { runImportAction } from "@/app/actions/imports";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

type Progress = { status: string; total: number; processed: number };

export function ProgressBar({ batchId, autoRefresh }: { batchId: string; autoRefresh?: boolean }) {
  const router = useRouter();
  const [p, setP] = useState<Progress>();
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/leads/import/${batchId}`, { cache: "no-store" });
        const json = await res.json();
        if (stop || !res.ok) return;
        setP(json.data);
        if (json.data.status === "COMPLETED" || json.data.status === "FAILED") { if (autoRefresh) router.refresh(); return; }
      } catch { /* keep trying */ }
      if (!stop) setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; };
  }, [batchId, autoRefresh, router]);

  const pct = p && p.total > 0 ? Math.min(100, Math.round((p.processed / p.total) * 100)) : 0;
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden><div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
      <p className="text-sm">{p ? `${p.processed.toLocaleString("en-IN")} of ${p.total.toLocaleString("en-IN")} rows processed (${pct}%)` : "Starting…"}</p>
    </div>
  );
}

function Submit({ batchId }: { batchId: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-3">
      <Button type="submit" loading={pending} className="md:w-56">{pending ? "Importing…" : "Start import"}</Button>
      {pending && <><ProgressBar batchId={batchId} /><p className="text-xs text-ink-muted">Keep this page open until it finishes.</p></>}
    </div>
  );
}

export function RunImportForm({ batchId, duplicateCount, defaultStrategy }: { batchId: string; duplicateCount: number; defaultStrategy: string }) {
  const [state, action] = useFormState(runImportAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="batchId" value={batchId} />
      {duplicateCount > 0 && (
        <fieldset className="flex flex-col gap-2 rounded-card border border-line bg-white p-4">
          <legend className="px-1 text-sm font-semibold">{duplicateCount} row{duplicateCount === 1 ? "" : "s"} match a mobile number that already exists. What should happen to them?</legend>
          {[
            ["SKIP", "Skip them", "Leave the existing leads untouched."],
            ["UPDATE", "Update the existing lead", "Overwrite name, email, city and state with the file's values; the change is recorded in the lead's timeline. Needs access to that lead."],
            ["KEEP_SEPARATE", "Keep as a separate lead", "Create a new lead (for example, the same person in another campaign)."],
          ].map(([v, t, d]) => (
            <label key={v} className="flex items-start gap-3 py-1 text-sm">
              <input type="radio" name="strategy" value={v} defaultChecked={v === defaultStrategy} className="mt-1 h-5 w-5" />
              <span><span className="font-medium">{t}</span><br /><span className="text-xs text-ink-muted">{d}</span></span>
            </label>
          ))}
          <p className="text-xs text-ink-muted">Rows that repeat an earlier row in the same file are always skipped.</p>
        </fieldset>
      )}
      {duplicateCount === 0 && <input type="hidden" name="strategy" value="SKIP" />}
      <FormMessage error={state?.error} success={state?.success} />
      <Submit batchId={batchId} />
    </form>
  );
}
