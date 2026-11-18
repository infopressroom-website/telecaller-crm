import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RuleForm } from "@/features/distribution/rule-form";
import { requirePagePermission } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getRule, getRuleFormOptions } from "@/services/distribution-service";

export const metadata: Metadata = { title: "Edit distribution rule" };
export const dynamic = "force-dynamic";

export default async function EditRulePage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission("distribution", "MANAGE");
  let rule;
  try { rule = await getRule(user, params.id); } catch (e) { if (e instanceof AppError && e.code === "NOT_FOUND") notFound(); throw e; }
  return (
    <>
      <PageHeader title={`Edit rule: ${rule.name}`} />
      <Card><RuleForm values={rule} {...await getRuleFormOptions(user)} /></Card>
    </>
  );
}
