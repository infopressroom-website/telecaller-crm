import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { REPORTS } from "@/lib/reports/definitions";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await requirePagePermission("report", "VIEW");
  const list = REPORTS.filter((r) => r.needs.every(([res, act]) => can(user, res, act as "VIEW")));
  return (
    <>
      <PageHeader title="Reports" description="Each report respects your data access. Export as CSV, Excel or PDF." />
      <div className="grid gap-4 md:grid-cols-2">{list.map((r) => <Card key={r.key}><Link href={`/reports/${r.key}`} className="text-base font-semibold text-brand-700 underline">{r.title}</Link><p className="mt-1 text-sm text-ink-muted">{r.description}</p></Card>)}</div>
    </>
  );
}
