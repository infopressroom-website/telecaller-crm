import type { Metadata } from "next";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ImportUpload } from "@/features/imports/import-upload";
import { requirePagePermission } from "@/lib/auth/session";
import { listBatches } from "@/services/import-service";
import { getLeadFormOptions } from "@/services/lead-service";

export const metadata: Metadata = { title: "Import leads" };
export const dynamic = "force-dynamic";

const TONE: Record<string, BadgeTone> = { MAPPING: "neutral", VALIDATED: "info", PROCESSING: "warning", COMPLETED: "success", FAILED: "danger" };
const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function ImportPage() {
  const user = await requirePagePermission("lead", "CREATE");
  const [{ sources, campaigns }, batches] = await Promise.all([getLeadFormOptions(user), listBatches(user)]);
  return (
    <>
      <PageHeader title="Import leads" description="Upload a CSV or Excel file, check it, then import." />
      <Card><ImportUpload sources={sources} campaigns={campaigns} /></Card>
      <Card>
        <h2 className="mb-2 text-base font-semibold">Import history</h2>
        {batches.length === 0 ? <EmptyState title="No imports yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-line text-ink-muted">{["File", "By", "When", "Status", "Rows", "Created", "Updated", "Skipped", "Failed"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100">
                    <td className="px-3 py-3"><Link href={`/leads/import/${b.id}`} className="font-medium text-brand-700 underline">{b.fileName}</Link></td>
                    <td className="px-3 py-3">{b.uploadedBy.name}</td>
                    <td className="whitespace-nowrap px-3 py-3">{fmt.format(b.createdAt)}</td>
                    <td className="px-3 py-3"><Badge tone={TONE[b.status] ?? "neutral"}>{b.status.toLowerCase()}</Badge></td>
                    <td className="px-3 py-3">{b.totalRows}</td><td className="px-3 py-3">{b.createdCount}</td><td className="px-3 py-3">{b.updatedCount}</td><td className="px-3 py-3">{b.skippedCount}</td><td className="px-3 py-3">{b.failedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
