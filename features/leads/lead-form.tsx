"use client";

import { useFormState } from "react-dom";
import { createLeadAction, updateLeadAction } from "@/app/actions/leads";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextAreaField } from "@/components/ui/textarea-field";
import { LEAD_PRIORITIES, PRIORITY_LABELS } from "@/lib/leads/fields";

type Opt = { id: string; name: string };
export type LeadFormValues = {
  id?: string; name?: string; primaryMobile?: string; alternateMobile?: string | null; email?: string | null; city?: string | null;
  state?: string | null; sourceId?: string | null; campaignId?: string | null; priority?: string; notes?: string | null;
};

export function LeadForm({
  mode, values = {}, sources, campaigns, fullEdit,
}: { mode: "create" | "edit"; values?: LeadFormValues; sources: Opt[]; campaigns: Opt[]; fullEdit: boolean }) {
  const [state, action] = useFormState(mode === "create" ? createLeadAction : updateLeadAction, undefined);
  const fe = (k: string) => state?.fieldErrors?.[k]?.[0];
  const mobile = values.primaryMobile ? values.primaryMobile.replace(/^91/, "") : "";
  const alt = values.alternateMobile ? values.alternateMobile.replace(/^91/, "") : "";

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {values.id && <input type="hidden" name="leadId" value={values.id} />}
      <div className="md:col-span-2"><FormMessage error={state?.error} success={state?.success} /></div>

      {fullEdit ? (
        <>
          <Field label="Name" name="name" defaultValue={values.name} error={fe("name")} maxLength={120} />
          <Field label="Primary mobile" name="primaryMobile" type="tel" defaultValue={mobile} error={fe("primaryMobile")} hint="10-digit Indian mobile number" />
        </>
      ) : (
        <>
          {/* Read-only for telecallers; the server ignores these fields for them. */}
          <input type="hidden" name="name" value={values.name ?? ""} />
          <input type="hidden" name="primaryMobile" value={mobile} />
        </>
      )}
      <Field label="Alternate mobile" name="alternateMobile" type="tel" required={false} defaultValue={alt} error={fe("alternateMobile")} />
      <Field label="Email" name="email" type="email" required={false} defaultValue={values.email ?? ""} error={fe("email")} />
      <Field label="City" name="city" required={false} defaultValue={values.city ?? ""} error={fe("city")} maxLength={100} />
      <Field label="State" name="state" required={false} defaultValue={values.state ?? ""} error={fe("state")} maxLength={100} />
      {fullEdit && (
        <>
          <SelectField label="Source" name="sourceId" placeholder="No source" defaultValue={values.sourceId ?? ""} options={sources.map((s) => ({ value: s.id, label: s.name }))} />
          <SelectField label="Campaign" name="campaignId" placeholder="No campaign" defaultValue={values.campaignId ?? ""} options={campaigns.map((c) => ({ value: c.id, label: c.name }))} />
        </>
      )}
      <SelectField label="Priority" name="priority" defaultValue={values.priority ?? "MEDIUM"} options={LEAD_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
      {fullEdit && <div className="md:col-span-2"><TextAreaField label="Notes" name="notes" defaultValue={values.notes ?? ""} error={fe("notes")} /></div>}

      {mode === "create" && state?.needsConfirm && (
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium md:col-span-2">
          <input type="checkbox" name="confirmDuplicate" className="h-5 w-5" /> Create anyway (keep as a separate record)
        </label>
      )}
      <div className="md:col-span-2 md:w-48"><SubmitButton>{mode === "create" ? "Create lead" : "Save changes"}</SubmitButton></div>
    </form>
  );
}
