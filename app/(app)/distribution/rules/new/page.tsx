import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RuleForm } from "@/features/distribution/rule-form";
import { requirePagePermission } from "@/lib/auth/session";
import { getRuleFormOptions } from "@/services/distribution-service";

export const metadata: Metadata = { title: "New distribution rule" };

export default async function NewRulePage() {
  const user = await requirePagePermission("distribution", "MANAGE");
  return (
    <>
      <PageHeader title="New distribution rule" />
      <Card><RuleForm {...await getRuleFormOptions(user)} /></Card>
    </>
  );
}
