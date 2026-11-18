import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { listAudit } from "@/services/audit-service";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";
const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });
const sel = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm";

export default async function AuditPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await requirePagePermission("audit", "VIEW");
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const { rows, meta, total } = await listAudit(user, { action: searchParams.action?.slice(0, 50), actorQuery: searchParams.actor?.slice(0, 60), from: date(searchParams.from), to: date(searchParams.to), page, pageSize: 50 });
  const qs = (p: number) => { const u = new URLSearchParams(); for (const k of ["action", "actor", "from", "to"]) if (searchParams[k]) u.set(k, searchParams[k]!); u.set("page", String(p)); return u.toString(); };
  return (
    <>
      <PageHeader title="Audit log" description={`${total.toLocaleString("en-IN")} entries. Append-only: entries cannot be edited or deleted from the app.`} />
      <form method="get" action="/audit" className="grid grid-cols-2 items-end gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-5">
        <label className="flex flex-col gap-1 text-sm font-medium">Action starts with<input name="action" defaultValue={searchParams.action ?? ""} placeholder="e.g. lead. or auth." className={sel} /></label>
        <label className="flex flex-col gap-1 text-sm font-medium">Person<input name="actor" defaultValue={searchParams.actor ?? ""} className={sel} /></label>
        <label className="flex flex-col gap-1 text-sm font-medium">From<input type="date" name="from" defaultValue={searchParams.from ?? ""} className={sel} /></label>
        <label className="flex flex-col gap-1 text-sm font-medium">To<input type="date" name="to" defaultValue={searchParams.to ?? ""} className={sel} /></label>
        <Button type="submit">Apply</Button>
      </form>
      {rows.length === 0 ? <EmptyState title="No entries match" /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-white"><table className="w-full text-left text-sm">
          <thead><tr className="border-b border-line text-ink-muted">{["When", "Who", "Action", "Record", "Details", "IP"].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 align-top"><td className="whitespace-nowrap px-3 py-2 text-xs">{when.format(r.createdAt)}</td><td className="px-3 py-2">{r.actor?.name ?? "System"}<div className="text-xs text-ink-muted">{r.actor?.email}</div></td><td className="px-3 py-2 font-mono text-xs">{r.action}</td><td className="px-3 py-2 text-xs">{r.entityType}{r.entityId ? ` ${r.entityId.slice(0, 12)}` : ""}</td><td className="max-w-xs truncate px-3 py-2 text-xs text-ink-muted" title={r.after ? JSON.stringify(r.after) : ""}>{r.after ? JSON.stringify(r.after).slice(0, 120) : ""}</td><td className="px-3 py-2 text-xs">{r.ipAddress ?? ""}</td></tr>))}</tbody>
        </table></div>
      )}
      <nav aria-label="Pagination" className="flex items-center justify-between text-sm"><span className="text-ink-muted">Page {meta.page} of {meta.totalPages}</span>
        <div className="flex gap-2">{meta.page > 1 ? <Link href={`/audit?${qs(meta.page - 1)}`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Previous</Link> : <Button variant="secondary" disabled>Previous</Button>}{meta.page < meta.totalPages ? <Link href={`/audit?${qs(meta.page + 1)}`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-semibold">Next</Link> : <Button variant="secondary" disabled>Next</Button>}</div></nav>
    </>
  );
}
