import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AutomationRuleForm } from "@/features/automation/rule-form";
import { requirePagePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "New automation rule" };

export default async function NewRulePage() {
  await requirePagePermission("automation", "MANAGE");
  const campaigns = await db.campaign.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return (<><PageHeader title="New automation rule" /><Card><AutomationRuleForm campaigns={campaigns} /></Card></>);
}
