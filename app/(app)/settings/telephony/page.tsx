import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { confirmVerificationAction, disableLiveAction, reconcileAction, retryEventsAction, testCredentialsAction } from "@/app/actions/telephony";
import { ActionButton } from "@/features/settings/action-button";
import { AgentPhoneRow, ConfigForm, TestCallForm } from "@/features/settings/telephony-forms";
import { requirePagePermission } from "@/lib/auth/session";
import { getTelephonyStatus, listAgentPhones } from "@/services/telephony-settings-service";

export const metadata: Metadata = { title: "Telephony settings" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const Check = ({ ok, label }: { ok: boolean; label: string }) => <li className="flex items-center gap-2 text-sm"><Badge tone={ok ? "success" : "danger"}>{ok ? "Set" : "Missing"}</Badge>{label}</li>;

export default async function TelephonyPage() {
  const user = await requirePagePermission("settings", "MANAGE");
  const [st, agents] = await Promise.all([getTelephonyStatus(user), listAgentPhones(user)]);
  const exotel = st.settings.provider === "exotel";
  const v = st.verification;
  const modeLabel = st.mode === "live" ? "Live calling is ON" : st.mode === "sandbox" ? "Sandbox (no real calls)" : "Manual: agents dial from their own phones";

  return (
    <>
      <PageHeader title="Telephony" description="Connects the CRM to a cloud telephony provider. Real calling stays off until a test call has been confirmed." />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Status</h2>
            <p className="mt-1"><Badge tone={st.mode === "live" ? "success" : st.mode === "sandbox" ? "warning" : "neutral"}>{modeLabel}</Badge></p>
            {st.problem && <p role="alert" className="mt-2 text-sm font-medium text-amber-900">{st.problem}</p>}
          </div>
          {st.mode === "live" && <div className="w-56"><ActionButton action={disableLiveAction} label="Switch live calling off" tone="danger" /></div>}
        </div>
        {exotel && (
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            <Check ok={st.creds.sid} label="EXOTEL_ACCOUNT_SID (server environment)" />
            <Check ok={st.creds.apiKey} label="EXOTEL_API_KEY (server environment)" />
            <Check ok={st.creds.apiToken} label="EXOTEL_API_TOKEN (server environment)" />
            <Check ok={st.creds.webhookSecret} label="EXOTEL_WEBHOOK_SECRET (24+ characters)" />
            <Check ok={st.appUrlIsHttps} label="APP_URL is a public https address" />
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-muted">API keys and tokens live only in the server environment. They are never stored in the database, shown here, or sent to the browser.</p>
      </Card>

      <Card><h2 className="mb-3 text-base font-semibold">1. Settings</h2><ConfigForm settings={st.settings} isProduction={st.isProduction} /></Card>

      {exotel && (
        <Card>
          <h2 className="mb-1 text-base font-semibold">2. Webhook</h2>
          <p className="text-sm">In Exotel, set the call status callback to:</p>
          <code className="mt-1 block break-all rounded-lg bg-slate-100 p-2 text-xs">{st.webhookUrl}</code>
          <p className="mt-2 text-xs text-ink-muted">The secret part is the value of <code>EXOTEL_WEBHOOK_SECRET</code>; it is not displayed here. Our system also sends this URL with every call it places.</p>
        </Card>
      )}

      {exotel && (
        <Card>
          <h2 className="mb-1 text-base font-semibold">3. Verify the integration</h2>
          <p className="mb-3 text-sm text-ink-muted">Calling is only enabled after you complete all three steps. Nothing below simulates a call.</p>
          <ol className="flex flex-col gap-5">
            <li>
              <p className="mb-2 text-sm font-semibold">Step 1: check the credentials {v.credentialsOkAt && <Badge tone="success">OK {fmt.format(new Date(v.credentialsOkAt))}</Badge>}</p>
              <ActionButton action={testCredentialsAction} label="Test credentials" />
            </li>
            <li>
              <p className="mb-2 text-sm font-semibold">Step 2: place a real test call between two phones you control {v.testCallAt && <Badge tone="info">Requested {fmt.format(new Date(v.testCallAt))}</Badge>}</p>
              {v.credentialsOkAt ? <TestCallForm /> : <p className="text-sm text-ink-muted">Complete step 1 first.</p>}
            </li>
            <li>
              <p className="mb-2 text-sm font-semibold">Step 3: confirm it worked {v.confirmedAt && <Badge tone="success">Confirmed {fmt.format(new Date(v.confirmedAt))}</Badge>}</p>
              {v.testCallId && !v.confirmedAt ? <ActionButton action={confirmVerificationAction} label="Yes: both phones rang and connected" tone="primary" /> : !v.confirmedAt ? <p className="text-sm text-ink-muted">Complete step 2 first.</p> : null}
            </li>
          </ol>
        </Card>
      )}

      <Card>
        <h2 className="mb-1 text-base font-semibold">Agent phone numbers</h2>
        <p className="mb-2 text-xs text-ink-muted">With live calling, the provider rings the agent on this number first, then connects the customer.</p>
        <div className="divide-y divide-slate-100">{agents.map((a) => <AgentPhoneRow key={a.id} {...a} />)}</div>
      </Card>

      <Card>
        <h2 className="mb-2 text-base font-semibold">Webhook health</h2>
        <p className="text-sm">{st.failedEvents} failed, {st.pendingEvents} stuck, {st.unmatched} ignored (no matching call, test calls, unknown callers).</p>
        <div className="mt-3 flex flex-wrap gap-6">
          <div className="w-60"><ActionButton action={retryEventsAction} label="Re-process failed events" /></div>
          <div className="w-72"><ActionButton action={reconcileAction} label="Check unfinished calls with the provider" /></div>
        </div>
        {st.recentUnmatched.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {st.recentUnmatched.map((e) => <li key={e.id} className="py-2"><Badge tone={e.status === "FAILED" ? "danger" : "neutral"}>{e.status.toLowerCase()}</Badge> {e.eventType} · {e.note ?? "—"} <span className="text-xs text-ink-muted">{fmt.format(e.receivedAt)}{e.providerCallId ? ` · ${e.providerCallId}` : ""}</span></li>)}
          </ul>
        )}
      </Card>
    </>
  );
}
