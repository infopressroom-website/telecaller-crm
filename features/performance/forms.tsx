"use client";

import { useFormState } from "react-dom";
import { decideIncentiveAction, generateIncentivesAction, saveBonusAction, saveSlabAction, saveTargetAction } from "@/app/actions/performance";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";

export const METRIC_OPTIONS = [
  { value: "CALL_ATTEMPTS", label: "Call attempts" }, { value: "CONNECTED_CALLS", label: "Connected calls" }, { value: "INTERESTED_LEADS", label: "Interested leads" },
  { value: "CONVERSIONS", label: "Conversions" }, { value: "FOLLOWUPS_COMPLETED", label: "Follow-ups completed" },
];

export function TargetForm({ people, teams }: { people: { id: string; name: string }[]; teams: { id: string; name: string }[] }) {
  const [state, action] = useFormState(saveTargetAction, undefined);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-4 md:items-end">
      <SelectField label="For one person" name="userId" placeholder="—" options={people.map((p) => ({ value: p.id, label: p.name }))} />
      <SelectField label="or a whole team" name="teamId" placeholder="—" options={teams.map((p) => ({ value: p.id, label: p.name }))} />
      <SelectField label="Measure" name="metric" required defaultValue="CALL_ATTEMPTS" options={METRIC_OPTIONS} />
      <SelectField label="Period" name="period" required defaultValue="DAILY" options={[{ value: "DAILY", label: "Daily" }, { value: "WEEKLY", label: "Weekly (Mon–Sun)" }, { value: "MONTHLY", label: "Monthly" }]} />
      <Field label="Target" name="value" type="number" />
      <Field label="Starts on" name="startsOn" type="date" />
      <Field label="Ends on" name="endsOn" type="date" required={false} />
      <SubmitButton>Add target</SubmitButton>
      <div className="md:col-span-4"><FormMessage error={state?.error} success={state?.success} /></div>
    </form>
  );
}

export function SlabForm({ slab }: { slab?: { id: string; name: string; metric: string; minValue: number; maxValue: number | null; amountPaise: number; isActive: boolean } }) {
  const [state, action] = useFormState(saveSlabAction, undefined);
  return (
    <form action={action} className="grid gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-4 md:items-end">
      {slab && <input type="hidden" name="id" value={slab.id} />}
      <Field label="Slab name" name="name" defaultValue={slab?.name} maxLength={60} />
      <SelectField label="Measure" name="metric" required defaultValue={slab?.metric ?? "CONVERSIONS"} options={METRIC_OPTIONS} />
      <Field label="From (at least)" name="minValue" type="number" defaultValue={String(slab?.minValue ?? 0)} />
      <Field label="To (at most)" name="maxValue" type="number" required={false} defaultValue={slab?.maxValue?.toString() ?? ""} />
      <Field label="Amount (₹)" name="amountRupees" type="number" defaultValue={slab ? String(slab.amountPaise / 100) : ""} />
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={slab?.isActive ?? true} className="h-5 w-5" /> Active</label>
      <SubmitButton>{slab ? "Save" : "Add slab"}</SubmitButton>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}

export function BonusForm({ rupees }: { rupees: number }) {
  const [state, action] = useFormState(saveBonusAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Bonus per conversion (₹)" name="bonus" type="number" defaultValue={String(rupees)} />
      <div className="w-28"><SubmitButton>Save</SubmitButton></div>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}

export function GenerateForm() {
  const [state, action] = useFormState(generateIncentivesAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="From" name="from" type="date" /><Field label="To" name="to" type="date" />
      <div className="w-52"><SubmitButton>Create statements</SubmitButton></div>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}

export function DecisionButtons({ id, status, canDecide }: { id: string; status: string; canDecide: boolean }) {
  const [state, action] = useFormState(decideIncentiveAction, undefined);
  if (!canDecide || !["PENDING_APPROVAL", "APPROVED"].includes(status)) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {status === "PENDING_APPROVAL" && (<><button name="op" value="approve" className="min-h-11 rounded-lg bg-brand px-3 text-sm font-semibold text-white">Approve</button><button name="op" value="reject" className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold">Reject</button></>)}
      {status === "APPROVED" && <button name="op" value="paid" className="min-h-11 rounded-lg bg-brand px-3 text-sm font-semibold text-white">Mark as paid</button>}
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
