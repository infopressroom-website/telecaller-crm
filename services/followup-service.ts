import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, can, type AuthUser } from "@/lib/auth/rbac";
import { followUpScopeWhere } from "@/lib/auth/scope";
import { addDays, startOfDayIST } from "@/lib/date-range";
import { AppError, notFound } from "@/lib/errors";
import { pageMeta, toPrismaPage } from "@/lib/pagination";
import { getAccessibleLead, resolveScope } from "./scope-service";

export const FOLLOWUP_VIEWS = ["today", "upcoming", "overdue", "completed", "missed"] as const;
export type FollowUpView = (typeof FOLLOWUP_VIEWS)[number];
export const VIEW_LABELS: Record<FollowUpView, string> = { today: "Due today", upcoming: "Upcoming", overdue: "Overdue", completed: "Completed", missed: "Missed" };

/** Overdue = still pending from an earlier day. Due today also shows a "late" flag once its time has passed. */
function viewWhere(view: FollowUpView, now: Date): Prisma.FollowUpWhereInput {
  const today = startOfDayIST(now);
  const tomorrow = addDays(today, 1);
  switch (view) {
    case "today": return { status: "PENDING", dueAt: { gte: today, lt: tomorrow } };
    case "upcoming": return { status: "PENDING", dueAt: { gte: tomorrow } };
    case "overdue": return { status: "PENDING", dueAt: { lt: today } };
    case "completed": return { status: "COMPLETED" };
    case "missed": return { status: "MISSED" };
  }
}

export async function listFollowUps(user: AuthUser, q: { view: FollowUpView; mine: boolean; page: number; pageSize: number }) {
  assertCan(user, "followup", "VIEW");
  const scope = await resolveScope(user);
  const now = new Date();
  const where: Prisma.FollowUpWhereInput = { AND: [followUpScopeWhere(scope), viewWhere(q.view, now), q.mine ? { ownerId: user.id } : {}] };
  const orderBy: Prisma.FollowUpOrderByWithRelationInput = q.view === "completed" ? { completedAt: "desc" } : { dueAt: q.view === "overdue" || q.view === "missed" ? "desc" : "asc" };

  const [counts, total, rows] = await Promise.all([
    Promise.all(FOLLOWUP_VIEWS.map((v) => db.followUp.count({ where: { AND: [followUpScopeWhere(scope), viewWhere(v, now), q.mine ? { ownerId: user.id } : {}] } }))),
    db.followUp.count({ where }),
    db.followUp.findMany({
      where, orderBy, ...toPrismaPage(q),
      select: {
        id: true, dueAt: true, status: true, priority: true, notes: true, completedAt: true,
        owner: { select: { id: true, name: true } }, lead: { select: { id: true, name: true, leadCode: true, primaryMobile: true } },
      },
    }),
  ]);
  return { rows, total, meta: pageMeta(total, q), counts: Object.fromEntries(FOLLOWUP_VIEWS.map((v, i) => [v, counts[i]!])) as Record<FollowUpView, number>, now };
}

/** Keeps lead.nextFollowUpAt equal to the earliest pending follow-up (or null). */
async function syncLead(tx: Prisma.TransactionClient, leadId: string) {
  const next = await tx.followUp.aggregate({ where: { leadId, status: "PENDING" }, _min: { dueAt: true } });
  await tx.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: next._min.dueAt ?? null } });
}

async function loadEditable(user: AuthUser, id: string) {
  assertCan(user, "followup", "EDIT");
  const f = await db.followUp.findUnique({ where: { id } });
  if (!f) throw notFound("Follow-up");
  await getAccessibleLead(user, f.leadId); // out-of-scope follow-ups look like they don't exist
  // Telecallers can only change their own; managers/leaders (who can see the team's) may change any in scope.
  if (f.ownerId !== user.id && user.roleKey === "TELECALLER") throw notFound("Follow-up");
  return f;
}

export async function completeFollowUp(user: AuthUser, id: string, note?: string) {
  const f = await loadEditable(user, id);
  await db.$transaction(async (tx) => {
    const won = await tx.followUp.updateMany({ where: { id, status: "PENDING" }, data: { status: "COMPLETED", completedAt: new Date() } });
    if (won.count !== 1) throw new AppError("CONFLICT", "This follow-up was already handled.");
    await syncLead(tx, f.leadId);
    await tx.leadActivity.create({ data: { leadId: f.leadId, type: "FOLLOWUP", actorId: user.id, message: note ? `Follow-up completed: ${note}` : "Follow-up completed" } });
  });
}

/** The old follow-up is kept (as RESCHEDULED) and a new one is created, so the history is never rewritten. */
export async function rescheduleFollowUp(user: AuthUser, id: string, dueAt: Date, reason: string) {
  const f = await loadEditable(user, id);
  const now = Date.now();
  if (dueAt.getTime() < now - 60_000) throw new AppError("VALIDATION_ERROR", "Pick a time in the future.");
  if (dueAt.getTime() > now + 365 * 86_400_000) throw new AppError("VALIDATION_ERROR", "Choose a time within the next year.");
  await db.$transaction(async (tx) => {
    const won = await tx.followUp.updateMany({ where: { id, status: "PENDING" }, data: { status: "RESCHEDULED" } });
    if (won.count !== 1) throw new AppError("CONFLICT", "This follow-up was already handled.");
    await tx.followUp.create({ data: { leadId: f.leadId, ownerId: f.ownerId, dueAt, priority: f.priority, notes: f.notes, rescheduledFromId: f.id } });
    await syncLead(tx, f.leadId);
    await tx.leadActivity.create({ data: { leadId: f.leadId, type: "FOLLOWUP", actorId: user.id, message: `Follow-up rescheduled${reason ? `: ${reason}` : ""}` } });
  });
}

export async function createFollowUp(user: AuthUser, leadId: string, dueAt: Date, notes?: string) {
  assertCan(user, "followup", "CREATE");
  const lead = await getAccessibleLead(user, leadId);
  if (dueAt.getTime() < Date.now() - 60_000) throw new AppError("VALIDATION_ERROR", "Pick a time in the future.");
  if (dueAt.getTime() > Date.now() + 365 * 86_400_000) throw new AppError("VALIDATION_ERROR", "Choose a time within the next year.");
  const ownerId = lead.ownerId ?? user.id;
  await db.$transaction(async (tx) => {
    await tx.followUp.create({ data: { leadId, ownerId, dueAt, priority: lead.priority, notes: notes || null } });
    await syncLead(tx, leadId);
    await tx.leadActivity.create({ data: { leadId, type: "FOLLOWUP", actorId: user.id, message: "Follow-up scheduled" } });
  });
}

/** Scheduled job: a follow-up still pending a day (configurable) after it was due becomes MISSED. */
export async function markMissedFollowUps(missedAfterHours = 24, now = new Date()) {
  const cutoff = new Date(now.getTime() - missedAfterHours * 3_600_000);
  const stale = await db.followUp.findMany({ where: { status: "PENDING", dueAt: { lt: cutoff } }, select: { id: true, leadId: true }, take: 500 });
  if (stale.length === 0) return 0;
  await db.$transaction(async (tx) => {
    await tx.followUp.updateMany({ where: { id: { in: stale.map((s) => s.id) }, status: "PENDING" }, data: { status: "MISSED" } });
    for (const leadId of new Set(stale.map((s) => s.leadId))) await syncLead(tx, leadId);
  }, { timeout: 60_000 });
  return stale.length;
}

export const canEditFollowUps = (user: AuthUser) => can(user, "followup", "EDIT");
