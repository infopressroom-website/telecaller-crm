import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { AgentRow } from "@/features/distribution/misc-forms";
import { DistributionNav } from "@/features/distribution/subnav";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { listAgents } from "@/services/distribution-service";

export const metadata: Metadata = { title: "Agents and limits" };
export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const user = await requirePagePermission("distribution", "VIEW");
  const agents = await listAgents(user);
  return (
    <>
      <PageHeader title="Agents and limits" description="Per-agent caps, service areas and a pause switch. Paused, inactive and absent agents never receive automatic assignments." />
      <DistributionNav user={user} active="agents" />
      {agents.length === 0 ? <EmptyState title="No telecallers in your area" /> : (
        <div className="flex flex-col gap-3">{agents.map((a) => <AgentRow key={a.id} agent={a} canEdit={can(user, "distribution", "EDIT")} />)}</div>
      )}
    </>
  );
}
