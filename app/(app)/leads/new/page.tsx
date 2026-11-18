import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LeadForm } from "@/features/leads/lead-form";
import { requirePagePermission } from "@/lib/auth/session";
import { getLeadFormOptions } from "@/services/lead-service";

export const metadata: Metadata = { title: "Add lead" };

export default async function NewLeadPage() {
  const user = await requirePagePermission("lead", "CREATE");
  const { sources, campaigns } = await getLeadFormOptions(user);
  return (
    <>
      <PageHeader title="Add lead" description="New leads start as unassigned; assign them from the lead list." />
      <Card><LeadForm mode="create" sources={sources} campaigns={campaigns} fullEdit /></Card>
    </>
  );
}
