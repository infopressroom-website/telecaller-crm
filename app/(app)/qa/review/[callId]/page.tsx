import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AnalyseButton, AnalysisDecision, ReviewForm, TranscriptForm } from "@/features/qa/forms";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { QA_CRITERIA, scoreBand } from "@/lib/qa/scorecard";
import { analysisSchema } from "@/lib/ai/provider";
import { getReviewContext } from "@/services/qa-service";

export const metadata: Metadata = { title: "Review call" };
export const dynamic = "force-dynamic";
const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function ReviewPage({ params }: { params: { callId: string } }) {
  const user = await requirePagePermission("qa", "VIEW");
  let ctx;
  try { ctx = await getReviewContext(user, params.callId); } catch (e) { if (e instanceof AppError && e.code === "NOT_FOUND") notFound(); throw e; }
  const { call, canPlayRecording, review, transcript, analyses } = ctx;
  const canReview = can(user, "qa", "CREATE") && !review && call.agent && true;
  const scorecard = (review?.scorecard ?? {}) as Record<string, number>;
  return (
    <>
      <PageHeader title={`Call with ${call.lead.name}`} description={`${call.agent.name} · ${call.disposition?.label ?? "no outcome"} · ${when.format(call.startedAt ?? call.createdAt)}`} actions={<Link href="/qa" className="inline-flex min-h-11 items-center text-sm text-brand-700 underline">Back to QA</Link>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card><h2 className="mb-2 text-base font-semibold">Recording</h2>
            {call.recording ? (canPlayRecording ? <audio controls preload="none" src={`/api/calls/${call.id}/recording`} className="w-full" /> : <p className="text-sm text-ink-muted">A recording exists but you don't have access to play it.</p>) : <p className="text-sm text-ink-muted">No recording stored. You can review from the agent's notes{transcript ? " and the transcript" : ""}.</p>}
            <p className="mt-2 text-sm"><span className="font-medium">Agent notes:</span> {call.notes ?? "—"}</p></Card>
          <Card><h2 className="mb-2 text-base font-semibold">Transcript</h2>
            {can(user, "qa", "CREATE") ? <TranscriptForm callId={call.id} text={transcript?.text} /> : <p className="whitespace-pre-wrap text-sm">{transcript?.text ?? "No transcript."}</p>}</Card>
          {transcript && can(user, "qa", "CREATE") && (
            <Card><h2 className="mb-1 text-base font-semibold">AI assistant (optional)</h2>
              <p className="mb-3 text-xs text-ink-muted">Suggestions only. A person must check them against the call; they are not scores, decisions or grounds for disciplinary action.</p>
              <AnalyseButton callId={call.id} />
              <div className="mt-4 flex flex-col gap-4">{analyses.map((a) => {
                const r = analysisSchema.safeParse(a.result);
                if (!r.success) return null;
                return (
                  <div key={a.id} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                    <p className="mb-2 text-xs font-semibold text-amber-900">AI-generated · needs human review · model-reported confidence {Math.round((a.confidence ?? 0) * 100)}% (indicative, not a guarantee) · <Badge tone={a.status === "ACCEPTED" ? "success" : a.status === "REJECTED" ? "danger" : "warning"}>{a.status.replace("_", " ").toLowerCase()}</Badge></p>
                    <p><strong>Summary:</strong> {r.data.summary}</p><p><strong>Customer intent:</strong> {r.data.customerIntent}</p>
                    {r.data.objections.length > 0 && <p><strong>Objections:</strong> {r.data.objections.join("; ")}</p>}
                    {r.data.coachingSuggestions.length > 0 && <p><strong>Coaching ideas:</strong> {r.data.coachingSuggestions.join("; ")}</p>}
                    <p><strong>Communication:</strong> {r.data.communicationNotes}</p>
                    {a.status === "PENDING_REVIEW" && <div className="mt-2"><AnalysisDecision id={a.id} callId={call.id} /></div>}
                  </div>);
              })}</div></Card>
          )}
        </div>
        <Card>
          <h2 className="mb-3 text-base font-semibold">{review ? "Review" : "Scorecard"}</h2>
          {review ? (
            <div className="text-sm"><p className="text-lg font-semibold">{review.score}% · {scoreBand(review.score)}</p><p className="text-xs text-ink-muted">By {review.reviewer.name} · {when.format(review.createdAt)}</p>
              <ul className="my-3 divide-y divide-slate-100">{QA_CRITERIA.map((c) => <li key={c.key} className="flex justify-between py-1.5"><span>{c.label}</span><span className="font-medium">{scorecard[c.key] ?? "—"} / 5</span></li>)}</ul>
              {review.feedback && <p><strong>Feedback:</strong> {review.feedback}</p>}{review.coachingNotes && <p><strong>Coaching:</strong> {review.coachingNotes}</p>}</div>
          ) : canReview ? <ReviewForm callId={call.id} /> : <p className="text-sm text-ink-muted">Not reviewed yet.</p>}
        </Card>
      </div>
    </>
  );
}
