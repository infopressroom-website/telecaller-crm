import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { backToMappingAction } from "@/app/actions/imports";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { MappingForm } from "@/features/imports/mapping-form";
import { ProgressBar, RunImportForm } from "@/features/imports/run-import";
import { requirePagePermission } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getBatchReview } from "@/services/import-service";

export const metadata: Metadata = { title: "Import" };
export const dynamic = "force-dynamic";

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border border-line bg-white p-3"><p className="text-xs text-ink-muted">{label}</p><p className="text-2xl font-bold">{value.toLocaleString("en-IN")}</p></div>
);

export default async function ImportBatchPage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission("lead", "CREATE");
  let review;
  try {
    review = await getBatchReview(user, params.id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { batch, counts, previewRows, invalid, duplicates } = review;
  const headers = batch.headers as string[];
  const c = (k: string) => counts[k] ?? 0;

  return (
    <>
      <PageHeader title={batch.fileName} description={`${batch.totalRows.toLocaleString("en-IN")} data rows · status: ${batch.status.toLowerCase()}`} actions={<Link href="/leads/import" className="inline-flex min-h-11 items-center text-sm text-brand-700 underline">All imports</Link>} />

      {batch.status === "MAPPING" && (
        <Card><MappingForm batchId={batch.id} headers={headers} mapping={(batch.mapping ?? {}) as Record<string, string>} preview={previewRows.map((r) => r.raw as Record<string, string>)} /></Card>
      )}

      {batch.status === "VALIDATED" && (
        <>
          <section aria-label="Check results" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Ready to import" value={c("VALID")} />
            <Stat label="Duplicate mobile" value={c("DUPLICATE")} />
            <Stat label="Invalid (will not import)" value={c("INVALID")} />
            <Stat label="Total rows" value={batch.totalRows} />
          </section>
          {invalid.length > 0 && (
            <Card>
              <h2 className="mb-2 text-base font-semibold">Rows with problems</h2>
              <p className="mb-2 text-xs text-ink-muted">These rows are not imported. Nothing is discarded: download the report after importing, fix them and upload again. Showing the first {invalid.length}.</p>
              <ul className="divide-y divide-slate-100 text-sm">{invalid.map((r) => <li key={r.id} className="py-2"><span className="font-medium">Row {r.rowNumber}:</span> {(r.errors as string[] | null)?.join("; ")}</li>)}</ul>
            </Card>
          )}
          {duplicates.length > 0 && (
            <Card>
              <h2 className="mb-2 text-base font-semibold">Duplicates found</h2>
              <ul className="divide-y divide-slate-100 text-sm">{duplicates.map((r) => <li key={r.id} className="py-2"><span className="font-medium">Row {r.rowNumber}:</span> {(r.errors as string[] | null)?.join("; ")}</li>)}</ul>
            </Card>
          )}
          <Card>
            {c("VALID") + c("DUPLICATE") === 0 ? <p className="text-sm">No importable rows. Go back and check your column mapping.</p> : <RunImportForm batchId={batch.id} duplicateCount={c("DUPLICATE")} defaultStrategy={batch.duplicateStrategy} />}
            <form action={backToMappingAction} className="mt-4"><input type="hidden" name="batchId" value={batch.id} /><button type="submit" className="min-h-11 text-sm text-brand-700 underline">Back to column mapping</button></form>
          </Card>
        </>
      )}

      {batch.status === "PROCESSING" && <Card><h2 className="mb-2 text-base font-semibold">Importing…</h2><ProgressBar batchId={batch.id} autoRefresh /></Card>}

      {(batch.status === "COMPLETED" || batch.status === "FAILED") && (
        <Card>
          <h2 className="mb-3 text-base font-semibold">{batch.status === "COMPLETED" ? "Import finished" : "Import stopped"}</h2>
          {batch.error && <p role="alert" className="mb-3 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-900">{batch.error}</p>}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Leads created" value={batch.createdCount} /><Stat label="Leads updated" value={batch.updatedCount} />
            <Stat label="Skipped" value={batch.skippedCount} /><Stat label="Failed / invalid" value={batch.failedCount} />
          </section>
          <div className="mt-4 flex flex-wrap gap-4">
            {batch.skippedCount + batch.failedCount > 0 && <a href={`/api/leads/import/${batch.id}/report`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">Download report of skipped and failed rows</a>}
            <Link href="/leads" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">View leads</Link>
          </div>
        </Card>
      )}
    </>
  );
}
