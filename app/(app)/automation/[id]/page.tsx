import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AutomationRuleForm } from "@/features/automation/rule-form";
import { requirePagePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getRule } from "@/services/automation-service";

export const metadata: Metadata = { title: "Edit automation rule" };
export const dynamic = "force-dynamic";

export default async function EditRulePage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission("automation", "MANAGE");
  let rule;
  try { rule = await getRule(user, params.id); } catch (e) { if (e instanceof AppError && e.code === "NOT_FOUND") notFound(); throw e; }
  const campaigns = await db.campaign.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return (<><PageHeader title={`Edit rule: ${rule.name}`} /><Card><AutomationRuleForm values={rule} campaigns={campaigns} /></Card></>);
}
