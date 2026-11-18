"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { analyseCallAction, createReviewAction, reviewAnalysisAction, saveTranscriptAction } from "@/app/actions/qa";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextAreaField } from "@/components/ui/textarea-field";
import { QA_CRITERIA, RATING_LABELS, computeScore } from "@/lib/qa/scorecard";

export function ReviewForm({ callId }: { callId: string }) {
  const [state, action] = useFormState(createReviewAction, undefined);
  const [r, setR] = useState<Record<string, number>>({});
  const score = computeScore(r);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="callId" value={callId} />
      <FormMessage error={state?.error} />
      {QA_CRITERIA.map((c) => (
        <fieldset key={c.key} className="rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-semibold">{c.label} <span className="font-normal text-ink-muted">({c.weight}%)</span></legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${r[c.key] === n ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
                <input type="radio" name={c.key} value={n} required className="sr-only" checked={r[c.key] === n} onChange={() => setR((x) => ({ ...x, [c.key]: n }))} />{n} · {RATING_LABELS[n]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p className="text-sm">Score: <strong className="text-lg">{score === null ? "rate every criterion" : `${score}%`}</strong></p>
      <TextAreaField label="Feedback for the telecaller" name="feedback" rows={3} maxLength={2000} />
      <TextAreaField label="Coaching notes (private to QA and managers)" name="coachingNotes" rows={3} maxLength={2000} />
      <div className="md:w-56"><SubmitButton>Save review</SubmitButton></div>
    </form>
  );
}

export function TranscriptForm({ callId, text }: { callId: string; text?: string }) {
  const [state, action] = useFormState(saveTranscriptAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="callId" value={callId} />
      <TextAreaField label="Transcript (paste or type)" name="text" defaultValue={text} rows={8} maxLength={50000} />
      <FormMessage error={state?.error} success={state?.success} />
      <div className="md:w-48"><SubmitButton>Save transcript</SubmitButton></div>
    </form>
  );
}

export function AnalyseButton({ callId }: { callId: string }) {
  const [state, action] = useFormState(analyseCallAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="callId" value={callId} />
      <div className="md:w-64"><SubmitButton>Analyse with AI (suggestion only)</SubmitButton></div>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}

export function AnalysisDecision({ id, callId }: { id: string; callId: string }) {
  const [state, action] = useFormState(reviewAnalysisAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="callId" value={callId} />
      <button name="op" value="accept" className="min-h-11 rounded-lg bg-brand px-3 text-sm font-semibold text-white">Looks accurate</button>
      <button name="op" value="reject" className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold">Not accurate</button>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
