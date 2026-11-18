import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TeamForm } from "@/features/team/forms";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listTeams } from "@/services/employee-service";

export const metadata: Metadata = { title: "Teams" };
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const user = await requirePagePermission("team", "VIEW");
  const [teams, people] = await Promise.all([listTeams(user), db.user.findMany({ where: { status: "ACTIVE", archivedAt: null, role: { key: { in: ["TEAM_LEADER", "MANAGER"] } } }, select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  return (
    <>
      <PageHeader title="Teams" />
      {can(user, "team", "CREATE") && <Card><h2 className="mb-3 text-base font-semibold">Add a team</h2><TeamForm people={people} /></Card>}
      <div className="flex flex-col gap-3">
        {teams.map((t) => (
          <div key={t.id}>
            <p className="mb-1 text-xs text-ink-muted">{t._count.members} member(s)</p>
            {can(user, "team", "EDIT") ? <TeamForm team={t} people={people} /> : <Card><p className="font-semibold">{t.name}</p><p className="text-sm text-ink-muted">Leader: {t.leader?.name ?? "—"}</p></Card>}
          </div>
        ))}
      </div>
    </>
  );
}
