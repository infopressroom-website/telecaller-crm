import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, can, type AuthUser } from "@/lib/auth/rbac";
import { AppError, notFound } from "@/lib/errors";
import { calculateIncentive, toPaise, type IncentiveCalc, type Slab } from "@/lib/performance/incentive";
import { audit } from "./audit-service";
import { directoryWhere } from "./employee-service";
import { METRIC_FIELD, computeMetrics } from "./performance-service";

const SETTINGS_KEY = "incentives";

export async function getIncentiveSettings(): Promise<{ conversionBonusPaise: number }> {
  const row = await db.setting.findUnique({ where: { key: SETTINGS_KEY } });
  const n = Number((row?.value as { conversionBonusPaise?: number } | null)?.conversionBonusPaise);
  return { conversionBonusPaise: Number.isFinite(n) && n >= 0 ? Math.round(n) : 0 };
}
export async function saveIncentiveSettings(user: AuthUser, conversionBonusRupees: number) {
  assertCan(user, "incentive", "MANAGE");
  const value = { conversionBonusPaise: toPaise(Math.max(0, conversionBonusRupees)) };
  await db.setting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
  await audit({ actorId: user.id, action: "incentive.settings", entityType: "Setting", entityId: SETTINGS_KEY, after: value });
}

// ───────────── slabs ─────────────

export async function listSlabs(user: AuthUser) {
  assertCan(user, "incentive", "VIEW");
  return db.incentiveSlab.findMany({ orderBy: [{ metric: "asc" }, { minValue: "asc" }] });
}

export async function saveSlab(user: AuthUser, input: { id?: string; name: string; metric: string; minValue: number; maxValue?: number; amountRupees: number; isActive: boolean }) {
  assertCan(user, "incentive", "MANAGE");
  const data = { name: input.name, metric: input.metric as "CONVERSIONS", minValue: input.minValue, maxValue: input.maxValue ?? null, amountPaise: toPaise(input.amountRupees), isActive: input.isActive };
  const s = input.id ? await db.incentiveSlab.update({ where: { id: input.id }, data }) : await db.incentiveSlab.create({ data });
  await audit({ actorId: user.id, action: input.id ? "incentive.slab_update" : "incentive.slab_create", entityType: "IncentiveSlab", entityId: s.id, after: data });
}

// ───────────── statements ─────────────

export async function listStatements(user: AuthUser) {
  assertCan(user, "incentive", "VIEW");
  const own = user.roleKey === "TELECALLER";
  const people = own ? [] : await db.user.findMany({ where: { AND: [await directoryWhere(user), { role: { key: "TELECALLER" } }] }, select: { id: true }, take: 1000 });
  const rows = await db.incentive.findMany({ where: own ? { userId: user.id, status: { in: ["APPROVED", "PAID", "PENDING_APPROVAL"] } } : { userId: { in: people.map((p) => p.id) } }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true } } } });
  const approvers = await db.user.findMany({ where: { id: { in: rows.flatMap((r) => (r.approvedById ? [r.approvedById] : [])) } }, select: { id: true, name: true } });
  const nm = new Map(approvers.map((a) => [a.id, a.name]));
  return rows.map((r) => ({ ...r, approvedByName: r.approvedById ? nm.get(r.approvedById) ?? null : null, calc: r.calculation as unknown as IncentiveCalc | null }));
}

/** Creates one statement per telecaller for the period (skipping anyone who already has a non-rejected one). */
export async function generateStatements(user: AuthUser, from: string, to: string) {
  assertCan(user, "incentive", "CREATE");
  const start = new Date(`${from}T00:00:00+05:30`), endIncl = new Date(`${to}T00:00:00+05:30`);
  if (endIncl < start) throw new AppError("VALIDATION_ERROR", "The end date must be on or after the start date.");
  if ((endIncl.getTime() - start.getTime()) / 86_400_000 > 92) throw new AppError("VALIDATION_ERROR", "Choose a period of at most 92 days.");
  const end = new Date(endIncl.getTime() + 86_400_000);

  const [people, slabs, settings] = await Promise.all([
    db.user.findMany({ where: { AND: [await directoryWhere(user), { status: "ACTIVE", role: { key: "TELECALLER" } }] }, select: { id: true }, take: 1000 }),
    db.incentiveSlab.findMany({ where: { isActive: true } }),
    getIncentiveSettings(),
  ]);
  if (slabs.length === 0 && settings.conversionBonusPaise === 0) throw new AppError("VALIDATION_ERROR", "Set up at least one slab or a conversion bonus first.");
  const metrics = await computeMetrics(people.map((p) => p.id), start, end);
  const slabInput: Slab[] = slabs.map((s) => ({ id: s.id, name: s.name, metric: s.metric, minValue: s.minValue, maxValue: s.maxValue, amountPaise: s.amountPaise }));
  const periodStart = new Date(`${from}T00:00:00Z`), periodEnd = new Date(`${to}T00:00:00Z`);

  let created = 0, skipped = 0;
  for (const p of people) {
    const exists = await db.incentive.findFirst({ where: { userId: p.id, periodStart, periodEnd, status: { not: "REJECTED" } } });
    if (exists) { skipped++; continue; }
    const m = metrics.get(p.id)!;
    const asRecord: Record<string, number> = Object.fromEntries(Object.entries(METRIC_FIELD).map(([k, f]) => [k, (m[f] as number) ?? 0]));
    const calc = calculateIncentive(asRecord, slabInput, settings.conversionBonusPaise);
    if (calc.totalPaise === 0) { skipped++; continue; }
    await db.incentive.create({ data: { userId: p.id, periodStart, periodEnd, amountPaise: calc.totalPaise, status: "PENDING_APPROVAL", calculation: calc as unknown as Prisma.InputJsonValue } });
    created++;
  }
  await audit({ actorId: user.id, action: "incentive.generate", entityType: "Incentive", after: { from, to, created, skipped } });
  return { created, skipped };
}

async function decide(user: AuthUser, id: string, from: "PENDING_APPROVAL" | "APPROVED", to: "APPROVED" | "REJECTED" | "PAID", action: string) {
  assertCan(user, "incentive", "APPROVE");
  const s = await db.incentive.findUnique({ where: { id } });
  if (!s) throw notFound("Statement");
  const visible = await db.user.findFirst({ where: { AND: [{ id: s.userId }, await directoryWhere(user)] } });
  if (!visible) throw notFound("Statement");
  if (s.userId === user.id) throw new AppError("FORBIDDEN", "You can't approve your own incentive.");
  const won = await db.incentive.updateMany({ where: { id, status: from }, data: { status: to, approvedById: user.id, approvedAt: new Date() } }); // compare-and-swap
  if (won.count !== 1) throw new AppError("CONFLICT", "This statement was already handled.");
  await audit({ actorId: user.id, action, entityType: "Incentive", entityId: id, after: { amountPaise: s.amountPaise, status: to } });
}
export const approveStatement = (u: AuthUser, id: string) => decide(u, id, "PENDING_APPROVAL", "APPROVED", "incentive.approve");
export const rejectStatement = (u: AuthUser, id: string) => decide(u, id, "PENDING_APPROVAL", "REJECTED", "incentive.reject");
export const markStatementPaid = (u: AuthUser, id: string) => decide(u, id, "APPROVED", "PAID", "incentive.paid");

export const canGenerate = (u: AuthUser) => can(u, "incentive", "CREATE");
