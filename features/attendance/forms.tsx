"use client";

import { useFormState, useFormStatus } from "react-dom";
import { assignShiftAction, clockAction, markLeaveAction, saveShiftAction } from "@/app/actions/attendance";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";

function Op({ op, label, tone = "secondary", disabled }: { op: string; label: string; tone?: "primary" | "secondary"; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" name="op" value={op} disabled={disabled || pending} className={`min-h-12 rounded-lg px-5 text-base font-semibold disabled:opacity-40 ${tone === "primary" ? "bg-brand text-white" : "border border-line bg-white"}`}>{label}</button>;
}

export function ClockWidget({ clockedIn, clockedOut, onBreak }: { clockedIn: boolean; clockedOut: boolean; onBreak: boolean }) {
  const [state, action] = useFormState(clockAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Op op="in" label="Clock in" tone="primary" disabled={clockedIn} />
        <Op op="break_start" label="Start break" disabled={!clockedIn || clockedOut || onBreak} />
        <Op op="break_end" label="End break" disabled={!onBreak} />
        <Op op="out" label="Clock out" disabled={!clockedIn || clockedOut} />
      </div>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}

export function LeaveForm({ people }: { people: { id: string; name: string }[] }) {
  const [state, action] = useFormState(markLeaveAction, undefined);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-6 md:items-end">
      <SelectField label="Employee" name="userId" required placeholder="Choose…" options={people.map((p) => ({ value: p.id, label: p.name }))} />
      <SelectField label="Mark as" name="status" required defaultValue="ON_LEAVE" options={[{ value: "ON_LEAVE", label: "On leave" }, { value: "ABSENT", label: "Absent" }, { value: "HALF_DAY", label: "Half day" }, { value: "HOLIDAY", label: "Holiday" }]} />
      <Field label="From" name="from" type="date" /><Field label="To" name="to" type="date" />
      <Field label="Note" name="notes" required={false} maxLength={300} />
      <SubmitButton>Mark</SubmitButton>
      <div className="md:col-span-6"><FormMessage error={state?.error} success={state?.success} /></div>
    </form>
  );
}

export function ShiftForm({ shift }: { shift?: { id: string; name: string; startTime: string; endTime: string; graceMinutes: number } }) {
  const [state, action] = useFormState(saveShiftAction, undefined);
  return (
    <form action={action} className="grid gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-5 md:items-end">
      {shift && <input type="hidden" name="id" value={shift.id} />}
      <Field label="Shift name" name="name" defaultValue={shift?.name} maxLength={60} />
      <Field label="Starts (HH:mm)" name="startTime" defaultValue={shift?.startTime ?? "10:00"} />
      <Field label="Ends (HH:mm)" name="endTime" defaultValue={shift?.endTime ?? "19:00"} />
      <Field label="Grace (minutes)" name="graceMinutes" type="number" defaultValue={String(shift?.graceMinutes ?? 10)} />
      <SubmitButton>{shift ? "Save" : "Add shift"}</SubmitButton>
      <div className="md:col-span-5"><FormMessage error={state?.error} success={state?.success} /></div>
    </form>
  );
}

export function AssignShiftForm({ people, shifts }: { people: { id: string; name: string }[]; shifts: { id: string; name: string }[] }) {
  const [state, action] = useFormState(assignShiftAction, undefined);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-4 md:items-end">
      <SelectField label="Employee" name="userId" required placeholder="Choose…" options={people.map((p) => ({ value: p.id, label: p.name }))} />
      <SelectField label="Shift" name="shiftId" required placeholder="Choose…" options={shifts.map((s) => ({ value: s.id, label: s.name }))} />
      <SubmitButton>Assign</SubmitButton>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
