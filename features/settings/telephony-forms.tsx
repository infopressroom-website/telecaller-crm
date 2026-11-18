"use client";

import { useFormState } from "react-dom";
import { placeTestCallAction, saveAgentPhoneAction, saveTelephonySettingsAction } from "@/app/actions/telephony";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { TelephonySettings } from "@/lib/telephony/config";

export function ConfigForm({ settings, isProduction }: { settings: TelephonySettings; isProduction: boolean }) {
  const [state, action] = useFormState(saveTelephonySettingsAction, undefined);
  const fe = (k: string) => state?.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><FormMessage error={state?.error} success={state?.success} /></div>
      <SelectField label="Provider" name="provider" required defaultValue={settings.provider} options={[
        { value: "none", label: "None: agents dial from their own phones" },
        { value: "exotel", label: "Exotel (real calls)" },
        ...(isProduction ? [] : [{ value: "sandbox", label: "Sandbox (development only, no real calls)" }]),
      ]} />
      <SelectField label="Exotel region" name="region" required defaultValue={settings.region} options={[{ value: "mumbai", label: "Mumbai (api.in.exotel.com)" }, { value: "singapore", label: "Singapore (api.exotel.com)" }]} />
      <Field label="Business number (ExoPhone / CallerId)" name="callerId" required={false} defaultValue={settings.callerId} error={fe("callerId")} hint="The number Exotel dials from. Confirm it is provisioned on your account." />
      <Field label="Provider timestamps are UTC+ (minutes)" name="utcOffsetMinutes" type="number" defaultValue={String(settings.utcOffsetMinutes)} hint="330 = India time. Confirm with your provider." />
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="record" defaultChecked={settings.record} className="h-5 w-5" /> Record calls (check the consent rules that apply to your business first)</label>
      <div className="md:col-span-2">
        <label htmlFor="allowedIps" className="text-sm font-medium">Only accept webhooks from these IP addresses (optional)</label>
        <textarea id="allowedIps" name="allowedIps" rows={2} defaultValue={settings.allowedIps.join("\n")} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="One per line or comma-separated. IPv4 ranges like 203.0.113.0/24 work." />
        {fe("allowedIps") && <p role="alert" className="text-xs font-medium text-red-700">{fe("allowedIps")}</p>}
        <p className="text-xs text-ink-muted">Get the current list from your provider. Leave empty to rely on the secret URL alone.</p>
      </div>
      <fieldset className="grid gap-3 rounded-lg border border-line p-3 md:col-span-2 md:grid-cols-3">
        <legend className="px-1 text-sm font-semibold">Webhook signature check (leave off until confirmed with Exotel)</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="signatureEnabled" defaultChecked={settings.signatureEnabled} className="h-5 w-5" /> Require a valid HMAC-SHA256 signature</label>
        <Field label="Signature header" name="signatureHeader" defaultValue={settings.signatureHeader} error={fe("signatureHeader")} />
        <SelectField label="Signature encoding" name="signatureEncoding" defaultValue={settings.signatureEncoding} options={[{ value: "base64", label: "base64" }, { value: "hex", label: "hex" }]} />
      </fieldset>
      <div className="md:w-48"><SubmitButton>Save settings</SubmitButton></div>
    </form>
  );
}

export function TestCallForm() {
  const [state, action] = useFormState(placeTestCallAction, undefined);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-3 md:items-end">
      <Field label="Your mobile (rings first)" name="agentNumber" type="tel" />
      <Field label="Second mobile (gets connected)" name="customerNumber" type="tel" />
      <SubmitButton>Place test call</SubmitButton>
      <div className="md:col-span-3"><FormMessage error={state?.error} success={state?.success} /></div>
    </form>
  );
}

export function AgentPhoneRow({ id, name, phone }: { id: string; name: string; phone: string | null }) {
  const [state, action] = useFormState(saveAgentPhoneAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 py-2">
      <input type="hidden" name="userId" value={id} />
      <span className="w-48 text-sm font-medium">{name}</span>
      <label className="flex flex-col gap-1 text-xs font-medium">Mobile
        <input name="phone" type="tel" defaultValue={phone ? phone.replace(/^91/, "") : ""} placeholder="not set" className="h-11 w-44 rounded-lg border border-slate-300 px-3 text-sm" />
      </label>
      <div className="w-24"><SubmitButton>Save</SubmitButton></div>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
