import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type ImportBatch, type ImportRow } from "@prisma/client";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { assertCan, can, type AuthUser } from "@/lib/auth/rbac";
import { leadWhere } from "@/lib/auth/scope";
import { AppError, notFound } from "@/lib/errors";
import { escapeCsvCell } from "@/lib/leads/csv-safe";
import { guessMapping, validateImportRow, validateMapping, type ImportedLead, type Mapping } from "@/lib/leads/import-mapping";
import type { ParsedFile } from "@/lib/leads/parse-file";
import { audit } from "./audit-service";
import { nextLeadCodes } from "./lead-code";
import { resolveScope } from "./scope-service";

type Strategy = "UPDATE" | "SKIP" | "KEEP_SEPARATE";
const CHUNK = 500;

async function loadBatch(user: AuthUser, id: string): Promise<ImportBatch> {
  assertCan(user, "lead", "CREATE");
  const batch = await db.importBatch.findUnique({ where: { id } });
  // Others' imports look like they don't exist.
  if (!batch || (batch.uploadedById !== user.id && !can(user, "lead", "MANAGE"))) throw notFound("Import");
  return batch;
}

const asMapping = (v: unknown): Mapping => (v && typeof v === "object" ? (v as Mapping) : {});

async function sourcesByName() {
  const sources = await db.leadSource.findMany({ where: { archivedAt: null }, select: { id: true, name: true } });
  return new Map(sources.map((s) => [s.name.toLowerCase(), s.id]));
}

// ───────────── step 1: upload ─────────────

export async function createBatch(
  user: AuthUser, file: { name: string; size: number }, parsed: ParsedFile, defaults: { campaignId?: string; sourceId?: string },
) {
  assertCan(user, "lead", "CREATE");
  if (defaults.campaignId && !(await db.campaign.findFirst({ where: { id: defaults.campaignId, archivedAt: null } }))) throw new AppError("VALIDATION_ERROR", "Unknown campaign.");
  if (defaults.sourceId && !(await db.leadSource.findFirst({ where: { id: defaults.sourceId, archivedAt: null } }))) throw new AppError("VALIDATION_ERROR", "Unknown source.");

  const batch = await db.importBatch.create({
    data: {
      fileName: file.name.slice(0, 200), fileSize: file.size, uploadedById: user.id, headers: parsed.headers,
      mapping: guessMapping(parsed.headers), totalRows: parsed.rows.length,
      campaignId: defaults.campaignId ?? null, sourceId: defaults.sourceId ?? null,
    },
  });
  for (let i = 0; i < parsed.rows.length; i += 1000) {
    await db.importRow.createMany({
      data: parsed.rows.slice(i, i + 1000).map((r) => ({ batchId: batch.id, rowNumber: r.rowNumber, raw: r.values })),
    });
  }
  return batch.id;
}

// ───────────── step 2: map + validate + find duplicates ─────────────

export async function validateBatch(user: AuthUser, id: string, mapping: Mapping) {
  const batch = await loadBatch(user, id);
  if (batch.status !== "MAPPING" && batch.status !== "VALIDATED") throw new AppError("CONFLICT", "This import has already started.");
  const headers = batch.headers as string[];
  const problem = validateMapping(mapping, headers);
  if (problem) throw new AppError("VALIDATION_ERROR", problem);

  await db.importRow.updateMany({ where: { batchId: id }, data: { status: "PENDING", errors: Prisma.DbNull, leadId: null, duplicateOfId: null } });
  const sources = await sourcesByName();
  const seenInFile = new Map<string, number>(); // mobile -> first row number

  for (let skip = 0; ; skip += 1000) {
    const rows = await db.importRow.findMany({ where: { batchId: id }, orderBy: { rowNumber: "asc" }, skip, take: 1000 });
    if (rows.length === 0) break;

    const parsed = rows.map((r) => ({ row: r, result: validateImportRow(r.raw as Record<string, string>, mapping, sources) }));
    const mobiles = [...new Set(parsed.flatMap((p) => (p.result.ok ? [p.result.data.primaryMobile] : [])))];
    const existing = await db.lead.findMany({ where: { primaryMobile: { in: mobiles }, archivedAt: null }, select: { id: true, primaryMobile: true }, orderBy: { createdAt: "asc" } });
    const existingByMobile = new Map<string, string>();
    for (const e of existing) if (!existingByMobile.has(e.primaryMobile)) existingByMobile.set(e.primaryMobile, e.id);

    const validIds: string[] = [];
    const individual: Prisma.PrismaPromise<unknown>[] = [];
    for (const { row, result } of parsed) {
      if (!result.ok) {
        individual.push(db.importRow.update({ where: { id: row.id }, data: { status: "INVALID", errors: result.errors } }));
        continue;
      }
      const mobile = result.data.primaryMobile;
      const firstRow = seenInFile.get(mobile);
      if (firstRow !== undefined) {
        individual.push(db.importRow.update({ where: { id: row.id }, data: { status: "DUPLICATE", errors: [`Same mobile as row ${firstRow} in this file`] } }));
        continue;
      }
      seenInFile.set(mobile, row.rowNumber);
      const dupOf = existingByMobile.get(mobile);
      if (dupOf) individual.push(db.importRow.update({ where: { id: row.id }, data: { status: "DUPLICATE", duplicateOfId: dupOf, errors: ["Mobile already exists in the system"] } }));
      else validIds.push(row.id);
    }
    if (validIds.length) individual.push(db.importRow.updateMany({ where: { id: { in: validIds } }, data: { status: "VALID" } }));
    for (let i = 0; i < individual.length; i += 100) await db.$transaction(individual.slice(i, i + 100));
  }
  await db.importBatch.update({ where: { id }, data: { mapping, status: "VALIDATED" } });
}

export async function resetToMapping(user: AuthUser, id: string) {
  const batch = await loadBatch(user, id);
  if (batch.status !== "VALIDATED") throw new AppError("CONFLICT", "Nothing to reset.");
  await db.importBatch.update({ where: { id }, data: { status: "MAPPING" } });
}

// ───────────── step 3: run ─────────────

type RowOutcome = { id: string; status: "CREATED" | "UPDATED" | "SKIPPED" | "FAILED"; leadId?: string; reason?: string };

export async function runImport(user: AuthUser, id: string, strategy: Strategy) {
  const batch = await loadBatch(user, id);
  // Atomic claim: only one run can win.
  const claim = await db.importBatch.updateMany({
    where: { id, status: "VALIDATED" },
    data: { status: "PROCESSING", duplicateStrategy: strategy, startedAt: new Date(), processedRows: 0, createdCount: 0, updatedCount: 0, skippedCount: 0, failedCount: 0 },
  });
  if (claim.count !== 1) throw new AppError("CONFLICT", "This import isn't ready to run (or is already running).");

  const mapping = asMapping(batch.mapping);
  const sources = await sourcesByName();
  const scope = await resolveScope(user);

  try {
    // Rows that failed validation were already marked INVALID and stay that way (reported, not dropped).
    for (;;) {
      const rows = await db.importRow.findMany({ where: { batchId: id, status: { in: ["VALID", "DUPLICATE"] } }, orderBy: { rowNumber: "asc" }, take: CHUNK });
      if (rows.length === 0) break;
      const outcomes = await processChunk(user, batch, rows, mapping, sources, strategy, scope);
      const count = (s: RowOutcome["status"]) => outcomes.filter((o) => o.status === s).length;
      await db.importBatch.update({
        where: { id },
        data: {
          processedRows: { increment: rows.length }, createdCount: { increment: count("CREATED") },
          updatedCount: { increment: count("UPDATED") }, skippedCount: { increment: count("SKIPPED") }, failedCount: { increment: count("FAILED") },
        },
      });
    }
    const invalid = await db.importRow.count({ where: { batchId: id, status: "INVALID" } });
    const done = await db.importBatch.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date(), failedCount: { increment: invalid } } });
    await audit({ actorId: user.id, action: "lead.import", entityType: "ImportBatch", entityId: id, after: { created: done.createdCount, updated: done.updatedCount, skipped: done.skippedCount, failed: done.failedCount, strategy } });
  } catch (e) {
    console.error("Import failed", e);
    await db.importBatch.update({ where: { id }, data: { status: "FAILED", error: "The import stopped unexpectedly. Rows already saved were kept; see the report for the rest.", completedAt: new Date() } });
    throw new AppError("INTERNAL_ERROR", "The import stopped unexpectedly. Rows already saved were kept.");
  }
}

async function processChunk(
  user: AuthUser, batch: ImportBatch, rows: ImportRow[], mapping: Mapping, sources: Map<string, string>, strategy: Strategy,
  scope: Awaited<ReturnType<typeof resolveScope>>,
): Promise<RowOutcome[]> {
  const outcomes: RowOutcome[] = [];
  const creates: { row: ImportRow; data: ImportedLead; separate: boolean }[] = [];
  const updates: { row: ImportRow; data: ImportedLead; existingId: string }[] = [];

  const dupIds = rows.flatMap((r) => (r.duplicateOfId ? [r.duplicateOfId] : []));
  const accessible = new Map(
    (await db.lead.findMany({ where: { AND: [{ id: { in: dupIds } }, leadWhere(scope)] } })).map((l) => [l.id, l]),
  );

  for (const row of rows) {
    const result = validateImportRow(row.raw as Record<string, string>, mapping, sources);
    if (!result.ok) { outcomes.push({ id: row.id, status: "FAILED", reason: result.errors.join("; ") }); continue; }
    if (row.status === "VALID") { creates.push({ row, data: result.data, separate: false }); continue; }
    if (!row.duplicateOfId) { outcomes.push({ id: row.id, status: "SKIPPED", reason: "Repeats an earlier row in this file" }); continue; }
    if (strategy === "SKIP") outcomes.push({ id: row.id, status: "SKIPPED", reason: "Duplicate of an existing lead (skipped)" });
    else if (strategy === "KEEP_SEPARATE") creates.push({ row, data: result.data, separate: true });
    else if (accessible.has(row.duplicateOfId)) updates.push({ row, data: result.data, existingId: row.duplicateOfId });
    else outcomes.push({ id: row.id, status: "SKIPPED", reason: "Existing lead is outside your access, so it was not updated" });
  }

  try {
    await db.$transaction(async (tx) => {
      const codes = await nextLeadCodes(tx, creates.length);
      const leads = creates.map((c, i) => ({
        id: randomUUID(), leadCode: codes[i]!, name: c.data.name, primaryMobile: c.data.primaryMobile,
        alternateMobile: c.data.alternateMobile ?? null, email: c.data.email ?? null, city: c.data.city ?? null, state: c.data.state ?? null,
        sourceId: c.data.sourceId ?? batch.sourceId, campaignId: batch.campaignId, priority: c.data.priority ?? ("MEDIUM" as const),
        notes: c.data.notes ?? null,
      }));
      if (leads.length) {
        await tx.lead.createMany({ data: leads });
        await tx.leadActivity.createMany({
          data: leads.map((l, i) => ({
            leadId: l.id, type: "IMPORTED" as const, actorId: user.id,
            message: creates[i]!.separate ? `Imported from ${batch.fileName} (duplicate mobile kept as a separate record)` : `Imported from ${batch.fileName}`,
            data: { batchId: batch.id },
          })),
        });
        for (const [i, l] of leads.entries()) {
          await tx.importRow.update({ where: { id: creates[i]!.row.id }, data: { status: "CREATED", leadId: l.id } });
          outcomes.push({ id: creates[i]!.row.id, status: "CREATED", leadId: l.id });
        }
      }
      for (const u of updates) {
        const cur = accessible.get(u.existingId)!;
        const next = {
          name: u.data.name, alternateMobile: u.data.alternateMobile ?? cur.alternateMobile, email: u.data.email ?? cur.email,
          city: u.data.city ?? cur.city, state: u.data.state ?? cur.state, campaignId: cur.campaignId ?? batch.campaignId,
        };
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        for (const [k, v] of Object.entries(next)) if ((cur as Record<string, unknown>)[k] !== v) changes[k] = { from: (cur as Record<string, unknown>)[k], to: v };
        if (Object.keys(changes).length) {
          await tx.lead.update({ where: { id: cur.id }, data: next });
          await tx.leadActivity.create({ data: { leadId: cur.id, type: "UPDATED", actorId: user.id, message: `Updated by import ${batch.fileName}`, data: { batchId: batch.id, changes } as Prisma.InputJsonValue } });
        }
        await tx.importRow.update({ where: { id: u.row.id }, data: { status: "UPDATED", leadId: cur.id } });
        outcomes.push({ id: u.row.id, status: "UPDATED", leadId: cur.id });
      }
    }, { timeout: 120_000, maxWait: 10_000 });
  } catch (e) {
    // The whole chunk rolled back, so none of its creates/updates were saved. Report them, don't hide them.
    console.error("Import chunk failed", e);
    const failed = [...creates.map((c) => c.row.id), ...updates.map((u) => u.row.id)];
    outcomes.splice(0, outcomes.length, ...outcomes.filter((o) => o.status === "SKIPPED" || o.status === "FAILED"));
    await db.importRow.updateMany({ where: { id: { in: failed } }, data: { status: "FAILED", errors: ["Could not be saved. Re-import these rows from the report."] } });
    for (const rid of failed) outcomes.push({ id: rid, status: "FAILED" });
  }

  for (const o of outcomes.filter((x) => x.status === "SKIPPED" || (x.status === "FAILED" && x.reason))) {
    await db.importRow.update({ where: { id: o.id }, data: { status: o.status, errors: [o.reason ?? ""] } });
  }
  return outcomes;
}

// ───────────── reading / reporting ─────────────

export async function getBatchProgress(user: AuthUser, id: string) {
  const b = await loadBatch(user, id);
  return { status: b.status, total: b.totalRows, processed: b.processedRows, created: b.createdCount, updated: b.updatedCount, skipped: b.skippedCount, failed: b.failedCount };
}

export async function getBatchReview(user: AuthUser, id: string) {
  const batch = await loadBatch(user, id);
  const [groups, previewRows, invalid, duplicates] = await Promise.all([
    db.importRow.groupBy({ by: ["status"], where: { batchId: id }, _count: { _all: true } }),
    db.importRow.findMany({ where: { batchId: id }, orderBy: { rowNumber: "asc" }, take: 5 }),
    db.importRow.findMany({ where: { batchId: id, status: { in: ["INVALID", "FAILED"] } }, orderBy: { rowNumber: "asc" }, take: 20 }),
    db.importRow.findMany({ where: { batchId: id, status: "DUPLICATE" }, orderBy: { rowNumber: "asc" }, take: 10 }),
  ]);
  return { batch, counts: Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Record<string, number>, previewRows, invalid, duplicates };
}

export async function listBatches(user: AuthUser) {
  assertCan(user, "lead", "CREATE");
  return db.importBatch.findMany({
    where: can(user, "lead", "MANAGE") ? {} : { uploadedById: user.id },
    orderBy: { createdAt: "desc" }, take: 20,
    select: { id: true, fileName: true, status: true, totalRows: true, createdCount: true, updatedCount: true, skippedCount: true, failedCount: true, createdAt: true, uploadedBy: { select: { name: true } } },
  });
}

/** Every row that did NOT become/update a lead, with its original columns and the reason. */
export async function failedRowsCsv(user: AuthUser, id: string): Promise<string> {
  const batch = await loadBatch(user, id);
  const headers = batch.headers as string[];
  const rows = await db.importRow.findMany({ where: { batchId: id, status: { notIn: ["CREATED", "UPDATED"] } }, orderBy: { rowNumber: "asc" }, take: 20_000 });
  const data = rows.map((r) => {
    const raw = r.raw as Record<string, string>;
    const reason = Array.isArray(r.errors) ? (r.errors as string[]).join("; ") : "";
    return [r.rowNumber, r.status, reason, ...headers.map((h) => raw[h] ?? "")].map(escapeCsvCell);
  });
  return Papa.unparse([["Row", "Status", "Reason", ...headers], ...data]);
}
