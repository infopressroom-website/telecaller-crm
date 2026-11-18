"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState } from "react-dom";
import { bulkAssignAction, bulkStatusAction } from "@/app/actions/leads";
import { Badge, LEAD_STATUS_TONE } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { LeadScoreBadge } from "@/components/leads/lead-score-badge";
import { LEAD_STATUSES, PRIORITY_LABELS, STATUS_LABELS, type LeadPriorityValue, type LeadStatusValue } from "@/lib/leads/fields";

export type LeadRow = {
  id: string; leadCode: string; name: string; primaryMobile: string; city: string | null;
  status: LeadStatusValue; priority: LeadPriorityValue; owner: string | null; team: string | null;
  source: string | null; campaign: string | null; nextFollowUpAt: string | null; createdAt: string;
  score: number | null;
};

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

export function LeadTable({
  rows, assignable, canAssign, canEdit,
}: { rows: LeadRow[]; assignable: { id: string; name: string; team: string | null }[]; canAssign: boolean; canEdit: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignState, assignAction] = useFormState(bulkAssignAction, undefined);
  const [statusState, statusAction] = useFormState(bulkStatusAction, undefined);
  const selectable = canAssign || canEdit;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const hidden = [...selected].map((id) => <input key={id} type="hidden" name="ids" value={id} />);

  if (rows.length === 0) return <EmptyState title="No leads match" description="Try clearing some filters, or add or import leads." />;

  return (
    <div className="flex flex-col gap-3">
      {selectable && selected.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-end gap-4 rounded-card border border-brand-100 bg-brand-50 p-3">
          <p className="text-sm font-semibold">{selected.size} selected on this page</p>
          {canAssign && (
            <form action={assignAction} className="flex items-end gap-2">
              {hidden}
              <label className="flex flex-col gap-1 text-xs font-medium">Assign to
                <select name="ownerId" required defaultValue="" className="h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm">
                  <option value="" disabled>Choose person…</option>
                  {assignable.map((u) => <option key={u.id} value={u.id}>{u.name}{u.team ? ` (${u.team})` : ""}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">Reason (needed to move owned leads)
                <input name="reason" maxLength={300} className="h-11 w-52 rounded-lg border border-slate-300 bg-white px-2 text-sm" />
              </label>
              <div className="w-28"><SubmitButton>Assign</SubmitButton></div>
            </form>
          )}
          {canEdit && (
            <form action={statusAction} className="flex items-end gap-2">
              {hidden}
              <label className="flex flex-col gap-1 text-xs font-medium">Set status
                <select name="status" required defaultValue="" className="h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm">
                  <option value="" disabled>Choose status…</option>
                  {LEAD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </label>
              <div className="w-28"><SubmitButton>Update</SubmitButton></div>
            </form>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="min-h-11 text-sm text-brand-700 underline">Clear selection</button>
        </div>
      )}
      <FormMessage error={assignState?.error ?? statusState?.error} success={assignState?.success ?? statusState?.success} />

      <div className="overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              {selectable && (
                <th scope="col" className="w-12 px-3 py-2">
                  <input type="checkbox" aria-label="Select all leads on this page" checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} className="h-5 w-5" />
                </th>
              )}
              {["Lead", "Mobile", "Status", "Score", "Priority", "Assigned to", "Source / campaign", "Next follow-up", "Created"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                {selectable && (
                  <td className="px-3 py-3">
                    <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-5 w-5" />
                  </td>
                )}
                <td className="px-3 py-3">
                  <Link href={`/leads/${r.id}`} className="font-medium text-brand-700 underline">{r.name}</Link>
                  <div className="text-xs text-ink-muted">{r.leadCode}{r.city ? ` · ${r.city}` : ""}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-3">+{r.primaryMobile}</td>
                <td className="px-3 py-3"><Badge tone={LEAD_STATUS_TONE[r.status] ?? "neutral"}>{STATUS_LABELS[r.status]}</Badge></td>
                <td className="px-3 py-3"><LeadScoreBadge leadId={r.id} score={r.score} /></td>
                <td className="px-3 py-3">{PRIORITY_LABELS[r.priority]}</td>
                <td className="px-3 py-3">{r.owner ?? <span className="text-ink-muted">Unassigned</span>}{r.team && <div className="text-xs text-ink-muted">{r.team}</div>}</td>
                <td className="px-3 py-3">{r.source ?? "—"}{r.campaign && <div className="text-xs text-ink-muted">{r.campaign}</div>}</td>
                <td className="whitespace-nowrap px-3 py-3">{date(r.nextFollowUpAt)}</td>
                <td className="whitespace-nowrap px-3 py-3">{date(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
