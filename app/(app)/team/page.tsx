import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listEmployees } from "@/services/employee-service";

export const metadata: Metadata = { title: "Team & employees" };
export const dynamic = "force-dynamic";
const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const sel = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm";

export default async function TeamPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await requirePagePermission("user", "VIEW");
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const [{ rows, meta, total }, roles, teams] = await Promise.all([
    listEmployees(user, { q: searchParams.q?.slice(0, 100), roleKey: searchParams.role, teamId: searchParams.teamId, status: searchParams.status, page, pageSize: 25 }),
    db.role.findMany({ select: { key: true, name: true }, orderBy: { name: "asc" } }),
    db.team.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const qs = (p: number) => { const u = new URLSearchParams(); for (const k of ["q", "role", "teamId", "status"]) if (searchParams[k]) u.set(k, searchParams[k]!); u.set("page", String(p)); return u.toString(); };
  return (
    <>
      <PageHeader title="Team & employees" description={`${total} ${total === 1 ? "person" : "people"}`} actions={<>
        <Link href="/team/teams" className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">Teams</Link>
        <Link href="/team/live" className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">Live status</Link>
        {can(user, "user", "CREATE") && <Link href="/team/new" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">Add employee</Link>}</>} />
      <form method="get" action="/team" className="grid grid-cols-2 items-end gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-5">
        <label className="col-span-2 flex flex-col gap-1 text-sm font-medium">Search name, email or ID<input name="q" defaultValue={searchParams.q ?? ""} className={sel} maxLength={100} /></label>
        <label className="flex flex-col gap-1 text-sm font-medium">Role<select name="role" defaultValue={searchParams.role ?? ""} className={sel}><option value="">Any</option>{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm font-medium">Team<select name="teamId" defaultValue={searchParams.teamId ?? ""} className={sel}><option value="">Any</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <Button type="submit">Apply</Button>
      </form>
      {rows.length === 0 ? <EmptyState title="No one matches" /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-line text-ink-muted">{["Name", "Role", "Team", "Reports to", "Status", "Last sign-in", ""].map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id} className="border-b border-slate-100">
                <td className="px-3 py-3"><span className="font-medium">{e.name}</span><div className="text-xs text-ink-muted">{e.email}{e.employeeId ? ` · ${e.employeeId}` : ""}</div></td>
                <td className="px-3 py-3">{e.role.name}</td><td className="px-3 py-3">{e.team?.name ?? "—"}</td><td className="px-3 py-3">{e.reportingTo?.name ?? "—"}</td>
                <td className="px-3 py-3"><Badge tone={e.status === "ACTIVE" ? "success" : "neutral"}>{e.status.toLowerCase()}</Badge>{e.lockedUntil && e.lockedUntil > new Date() && <> <Badge tone="danger">locked</Badge></>}{e.mustChangePassword && <> <Badge tone="warning">temp password</Badge></>}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-muted">{e.lastLoginAt ? when.format(e.lastLoginAt) : "Never"}</td>
                <td className="px-3 py-3">{can(user, "user", "EDIT") && <Link href={`/team/${e.id}`} className="text-brand-700 underline">Edit</Link>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <nav aria-label="Pagination" className="flex items-center justify-between text-sm"><span className="text-ink-muted">Page {meta.page} of {meta.totalPages}</span>
        <div className="flex gap-2">{meta.page > 1 ? <Link href={`/team?${qs(meta.page - 1)}`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Previous</Link> : <Button variant="secondary" disabled>Previous</Button>}{meta.page < meta.totalPages ? <Link href={`/team?${qs(meta.page + 1)}`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Next</Link> : <Button variant="secondary" disabled>Next</Button>}</div></nav>
    </>
  );
}
