import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AiToggleForm } from "@/features/settings/ai-form";
import { requirePagePermission } from "@/lib/auth/session";
import { getAiStatus } from "@/services/ai-service";

export const metadata: Metadata = { title: "AI assistant" };
export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const user = await requirePagePermission("settings", "MANAGE");
  const s = await getAiStatus(user);
  return (
    <>
      <PageHeader title="AI assistant" description="Optional. Summarises call transcripts for QA reviewers. Off by default." />
      <Card>
        <ul className="mb-3 grid gap-1 text-sm"><li><Badge tone={s.keyConfigured ? "success" : "danger"}>{s.keyConfigured ? "Set" : "Missing"}</Badge> ANTHROPIC_API_KEY (server environment)</li><li><Badge tone={s.modelConfigured ? "success" : "danger"}>{s.modelConfigured ? "Set" : "Missing"}</Badge> AI_MODEL (server environment){s.model ? `: ${s.model}` : ""}</li></ul>
        <p className="mb-3 text-sm text-ink-muted">When enabled, the transcript text of a call (which can contain customers' names, numbers and personal details) is sent to the AI provider whenever a QA reviewer presses “Analyse”. Check this is allowed by your privacy policy and customer consent first. Results are suggestions for a human to check, never scores or decisions. Automatic speech-to-text from recordings is <strong>not</strong> included: transcripts are pasted or typed.</p>
        <AiToggleForm enabled={s.enabled} />
      </Card>
    </>
  );
}
