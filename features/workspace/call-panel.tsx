"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveCallAction, startCallAction, type SaveResult } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, type LeadStatusValue } from "@/lib/leads/fields";
import { requiresFollowUp } from "@/lib/workspace/status";

type Disposition = { id: string; key: string; label: string; isConnected: boolean; requiresFollowUp: boolean };
type Props = {
  leadId: string; leadName: string; phone: string; dispositions: Disposition[];
  activeCall: { callRef: string; startedAt: string } | null; nextHref: string; blockedReason?: string;
  telephonyMode: "manual" | "live" | "sandbox";
};
type Phase = "idle" | "active" | "saved";
type Draft = { callRef?: string; dispositionId: string; notes: string; fuEnabled: boolean; fuAt: string; nextAction: string };

const SHORTCUT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };

// crypto.randomUUID only exists on HTTPS/localhost; fall back so the screen still works on a plain-HTTP intranet.
function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const inFuture = (ms: number) => new Date(Date.now() + ms).toISOString();
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function CallPanel({ leadId, leadName, phone, dispositions, activeCall, nextHref, blockedReason, telephonyMode }: Props) {
  const draftKey = `crm:draft:${leadId}`;
  const [callRef, setCallRef] = useState(() => activeCall?.callRef ?? uuid());
  const [phase, setPhase] = useState<Phase>(activeCall ? "active" : "idle");
  const [startedAt, setStartedAt] = useState<number | null>(activeCall ? Date.parse(activeCall.startedAt) : null);
  const [now, setNow] = useState(() => Date.now());
  const [dispositionId, setDispositionId] = useState("");
  const [notes, setNotes] = useState("");
  const [fuEnabled, setFuEnabled] = useState(false);
  const [fuAt, setFuAt] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [result, setResult] = useState<Extract<SaveResult, { ok: true }> | null>(null);
  const [restored, setRestored] = useState(false);
  const [pending, startTransition] = useTransition();
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const chosen = useMemo(() => dispositions.find((d) => d.id === dispositionId), [dispositions, dispositionId]);
  const needsFollowUp = !!chosen && requiresFollowUp(chosen);
  const dirty = phase !== "saved" && (!!dispositionId || notes.trim() !== "" || fuEnabled || nextAction.trim() !== "");

  // ---- safe draft handling: keep what the agent typed on this device until it is saved ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (!activeCall || !d.callRef || d.callRef === activeCall.callRef) {
          setDispositionId(dispositions.some((x) => x.id === d.dispositionId) ? d.dispositionId : "");
          setNotes(d.notes ?? ""); setFuEnabled(!!d.fuEnabled); setFuAt(d.fuAt ?? ""); setNextAction(d.nextAction ?? "");
          if (d.notes || d.dispositionId) setRestored(true);
        }
      }
    } catch { /* storage unavailable: drafts just won't persist */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (phase === "saved") return;
    try {
      if (dirty) localStorage.setItem(draftKey, JSON.stringify({ callRef, dispositionId, notes, fuEnabled, fuAt, nextAction } satisfies Draft));
      else localStorage.removeItem(draftKey);
    } catch { /* ignore */ }
  }, [dirty, draftKey, callRef, dispositionId, notes, fuEnabled, fuAt, nextAction, phase]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  useEffect(() => {
    if (phase !== "active" || startedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase, startedAt]);

  // ---- actions ----
  const start = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await startCallAction({ leadId, callRef });
      if (!r.ok) { setMsg({ kind: "error", text: r.error }); return; }
      setStartedAt(Date.parse(r.startedAt)); setNow(Date.now()); setPhase("active");
      if (r.mode === "manual") window.location.href = `tel:+${phone}`; // no provider: the agent dials from their own phone
      else if (r.mode === "live") setMsg({ kind: "info", text: "Your phone will ring first. Answer it and the customer is connected." });
      else setMsg({ kind: "info", text: "SANDBOX MODE: no real call is being placed." });
    });
  };

  const chooseDisposition = useCallback((d: Disposition) => {
    setDispositionId(d.id);
    if (requiresFollowUp(d)) { setFuEnabled(true); setFuAt((cur) => cur || inFuture(86_400_000)); }
    setMsg(null);
  }, []);

  const save = useCallback(() => {
    if (!dispositionId) { setMsg({ kind: "error", text: "Choose a call outcome first." }); return; }
    if (needsFollowUp && !fuAt) { setMsg({ kind: "error", text: "Pick when to call back." }); return; }
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await saveCallAction({ leadId, callRef, dispositionId, notes, followUpAt: fuEnabled && fuAt ? fuAt : null, nextAction });
        if (!r.ok) { setMsg({ kind: "error", text: r.error }); return; }
        try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
        setResult(r); setPhase("saved");
      } catch {
        setMsg({ kind: "error", text: "Couldn't reach the server. Your notes are kept on this screen; press Save again (it won't create a duplicate)." });
      }
    });
  }, [dispositionId, needsFollowUp, fuAt, leadId, callRef, notes, fuEnabled, nextAction, draftKey]);

  const another = () => {
    setCallRef(uuid()); setPhase("idle"); setStartedAt(null); setDispositionId(""); setNotes(""); setFuEnabled(false); setFuAt(""); setNextAction(""); setResult(null); setMsg(null); setRestored(false);
  };

  // ---- keyboard shortcuts: 1–9,0 choose an outcome · F follow-up · N notes · Ctrl/⌘+Enter save ----
  useEffect(() => {
    if (phase !== "active") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); save(); return; }
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || t.closest("input, textarea, select, [contenteditable]")) return;
      const i = SHORTCUT_KEYS.indexOf(e.key);
      if (i >= 0 && dispositions[i]) { e.preventDefault(); chooseDisposition(dispositions[i]!); }
      else if (e.key.toLowerCase() === "n") { e.preventDefault(); notesRef.current?.focus(); }
      else if (e.key.toLowerCase() === "f") { e.preventDefault(); setFuEnabled((v) => { if (!v) setFuAt((c) => c || inFuture(86_400_000)); return !v; }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, dispositions, chooseDisposition, save]);

  const elapsed = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : null;
  const steps = [
    { label: "Start call", done: phase !== "idle" },
    { label: "Outcome", done: !!dispositionId },
    { label: "Notes", done: notes.trim() !== "" },
    { label: "Follow-up", done: fuEnabled && !!fuAt },
    { label: "Save", done: phase === "saved" },
  ];
  const input = "h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm";

  if (blockedReason) return <p role="alert" className="rounded-card border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">{blockedReason}</p>;

  return (
    <section aria-label="Call workflow" className="flex flex-col gap-4 rounded-card border border-line bg-white p-4">
      <ol className="flex flex-wrap gap-2" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s.label} aria-current={!s.done && steps.slice(0, i).every((p) => p.done || p.label === "Notes" || p.label === "Follow-up") ? "step" : undefined}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${s.done ? "bg-green-100 text-green-900" : "bg-slate-100 text-slate-700"}`}>
            {s.done ? "✓ " : `${i + 1}. `}{s.label}
          </li>
        ))}
      </ol>

      <div role="status" aria-live="polite" className="min-h-6">
        {msg && <p role={msg.kind === "error" ? "alert" : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${msg.kind === "error" ? "bg-red-100 text-red-900" : "bg-blue-50 text-brand-700"}`}>{msg.text}</p>}
        {restored && phase !== "saved" && !msg && <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">We restored your unsaved notes from this device.</p>}
      </div>

      {phase === "idle" && (
        <div className="flex flex-col gap-3">
          {telephonyMode === "sandbox" && <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">SANDBOX MODE — pressing Start does not place a real call.</p>}
          {telephonyMode === "live" && <p className="text-xs text-ink-muted">The system will ring your phone first, then connect the customer.</p>}
          <Button onClick={start} loading={pending} className="min-h-14 text-base">{pending ? "Starting…" : `Start call to ${leadName}`}</Button>
          <button type="button" onClick={() => setPhase("active")} className="min-h-11 text-sm text-brand-700 underline">I already made this call — log it</button>
          <Link href={nextHref} className="min-h-11 text-sm text-ink-muted underline">Skip this lead</Link>
        </div>
      )}

      {phase === "active" && (
        <>
          {elapsed !== null && <p className="text-sm" aria-live="off">Call timer: <strong className="text-lg tabular-nums">{mmss(elapsed)}</strong> <span className="text-xs text-ink-muted">(on-screen timer)</span></p>}

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Outcome <span className="font-normal text-ink-muted">(press the number key)</span></legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {dispositions.map((d, i) => (
                <button key={d.id} type="button" aria-pressed={d.id === dispositionId} onClick={() => chooseDisposition(d)}
                  className={`flex min-h-12 items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm font-medium ${d.id === dispositionId ? "border-brand bg-brand text-white" : "border-line bg-white hover:bg-slate-50"}`}>
                  <span>{d.label}</span>
                  {i < SHORTCUT_KEYS.length && <kbd className={`rounded px-1.5 text-xs ${d.id === dispositionId ? "bg-white/20" : "bg-slate-100"}`}>{SHORTCUT_KEYS[i]}</kbd>}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="call-notes" className="text-sm font-semibold">Call notes <kbd className="rounded bg-slate-100 px-1.5 text-xs font-normal">N</kbd></label>
            <textarea id="call-notes" ref={notesRef} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={4}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="What did the customer say? Budget, timing, objections…" />
            <p className="text-xs text-ink-muted">{notes.length}/2000 · saved on this device until you press Save</p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-5 w-5" checked={fuEnabled || needsFollowUp} disabled={needsFollowUp}
                onChange={(e) => { setFuEnabled(e.target.checked); if (e.target.checked && !fuAt) setFuAt(inFuture(86_400_000)); }} />
              Schedule a follow-up {needsFollowUp ? "(required)" : <kbd className="rounded bg-slate-100 px-1.5 text-xs font-normal">F</kbd>}
            </label>
            {(fuEnabled || needsFollowUp) && (
              <>
                <div className="flex flex-wrap gap-2">
                  {[["In 1 hour", 3_600_000], ["In 4 hours", 4 * 3_600_000], ["Tomorrow", 86_400_000], ["In 3 days", 3 * 86_400_000], ["In a week", 7 * 86_400_000]].map(([l, ms]) => (
                    <button key={l as string} type="button" onClick={() => setFuAt(inFuture(ms as number))} className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm">{l as string}</button>
                  ))}
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium">Or pick a date and time (India time)
                  <input type="datetime-local" className={input} onChange={(e) => e.target.value && setFuAt(new Date(`${e.target.value}:00+05:30`).toISOString())} />
                </label>
                {fuAt && <p className="text-sm">Follow-up: <strong>{new Date(fuAt).toLocaleString("en-IN", IST)}</strong></p>}
                <label className="flex flex-col gap-1 text-xs font-medium">Next action (optional)
                  <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} maxLength={300} className={input} placeholder="e.g. Send brochure on WhatsApp" />
                </label>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} loading={pending} disabled={!dispositionId} className="min-h-14 flex-1 text-base">{pending ? "Saving…" : "Save activity"}</Button>
            <span className="text-xs text-ink-muted">Ctrl/⌘ + Enter</span>
          </div>
        </>
      )}

      {phase === "saved" && result && (
        <div className="flex flex-col gap-3">
          <p role="status" className="rounded-lg bg-green-100 px-3 py-3 text-sm font-semibold text-green-900">
            ✓ {result.alreadySaved ? "This call was already saved." : `Saved: ${result.outcome}.`}
            {result.newStatus && <> Lead is now <strong>{STATUS_LABELS[result.newStatus as LeadStatusValue] ?? result.newStatus}</strong>.</>}
            {result.followUpAt && <> Follow-up set for {new Date(result.followUpAt).toLocaleString("en-IN", IST)}.</>}
          </p>
          <Link href={nextHref.replace(/\?.*$/, "")} autoFocus className="inline-flex min-h-14 items-center justify-center rounded-lg bg-brand px-4 text-base font-semibold text-white">Next eligible lead →</Link>
          <button type="button" onClick={another} className="min-h-11 text-sm text-brand-700 underline">Log another call on this lead</button>
          <Link href="/workspace" className="min-h-11 text-sm text-ink-muted underline">Back to my workspace</Link>
        </div>
      )}
    </section>
  );
}
