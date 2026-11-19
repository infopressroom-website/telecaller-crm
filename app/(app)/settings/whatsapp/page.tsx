import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { getWhatsAppSettings, webhookUrl } from "@/lib/whatsapp/config";
import { ConfigForm, TestCredentialsButton, SyncTemplatesButton } from "@/features/settings/whatsapp-forms";

export const metadata: Metadata = { title: "WhatsApp Settings" };
export const dynamic = "force-dynamic";

export default async function WhatsAppSettingsPage() {
  const user = await requirePagePermission("settings", "MANAGE");
  const settings = await getWhatsAppSettings();

  const hasCredentials = !!settings.credentials;
  const isEnabled = settings.enabled;
  const status = isEnabled && hasCredentials ? "active" : hasCredentials ? "ready" : "unconfigured";

  return (
    <>
      <PageHeader
        title="WhatsApp Integration"
        description="Connect Meta WhatsApp Business API for bidirectional messaging with leads."
      />

      <Card>
        <h2 className="mb-2 text-base font-semibold">Status</h2>
        <Badge tone={status === "active" ? "success" : status === "ready" ? "neutral" : "danger"}>
          {status === "active" ? "Active" : status === "ready" ? "Ready (disabled)" : "Not configured"}
        </Badge>

        {!hasCredentials && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
            <p className="font-semibold">Setup Required</p>
            <p className="mt-1">
              Add the following environment variables to the server:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 font-mono text-xs">
              <li>WHATSAPP_PHONE_NUMBER_ID</li>
              <li>WHATSAPP_ACCESS_TOKEN</li>
              <li>WHATSAPP_BUSINESS_ACCOUNT_ID</li>
              <li>WHATSAPP_VERIFY_TOKEN (24+ characters, you choose this)</li>
            </ul>
            <p className="mt-2">
              Get these from{" "}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Meta for Developers
              </a>
              . Restart the server after adding them.
            </p>
          </div>
        )}

        {hasCredentials && (
          <div className="mt-3 text-sm text-slate-600">
            Credentials detected. Configure webhook in Meta dashboard.
          </div>
        )}
      </Card>

      {hasCredentials && (
        <>
          <Card>
            <h2 className="mb-3 text-base font-semibold">Webhook Configuration</h2>
            <p className="text-sm">
              In Meta for Developers → WhatsApp → Configuration → Webhook, set:
            </p>
            <div className="mt-2">
              <label className="text-sm font-medium">Callback URL</label>
              <code className="mt-1 block break-all rounded bg-slate-100 p-2 text-xs">
                {webhookUrl()}
              </code>
            </div>
            <div className="mt-3">
              <label className="text-sm font-medium">Verify Token</label>
              <p className="text-sm text-slate-600">
                Use the value of <code>WHATSAPP_VERIFY_TOKEN</code> (not shown here for security).
              </p>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Subscribe to webhook fields: <strong>messages</strong> and <strong>message_status</strong>.
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold">Test Connection</h2>
            <TestCredentialsButton />
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold">Enable/Disable</h2>
            <ConfigForm enabled={isEnabled} />
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold">Templates</h2>
            <p className="mb-3 text-sm text-slate-600">
              Sync approved message templates from Meta to use them in conversations.
            </p>
            <SyncTemplatesButton />
          </Card>
        </>
      )}
    </>
  );
}
