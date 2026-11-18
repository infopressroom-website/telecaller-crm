import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { addDays, dayKeyIST, startOfDayIST } from "@/lib/date-range";
import type { PriorityKey } from "@/lib/distribution/engine";
import { AppError, notFound } from "@/lib/errors";
import type { LeadStatusValue } from "@/lib/leads/fields";
import { rankQueue, type QueueLead } from "@/lib/workspace/queue";
import { isTerminal } from "@/lib/telephony/status";
import { callStatusFor, nextLeadStatus, requiresFollowUp } from "@/lib/workspace/status";
import type { SaveCallInput } from "@/validations/workspace";
import { startProviderCall } from "./call-service";
import { getLeadDetail } from "./lead-service";
import { getActiveTelephony } from "./telephony-settings-service";
import { getAccessibleLead } from "./scope-service";

const FINAL = ["CONVERTED", "LOST", "INVALID", "DND"] as const;
const OPEN_CALL_STATUSES = ["INITIATED", "RINGING", "IN_PROGRESS"] as const;
const MANUAL = "manual";
const MAX_FOLLOWUP_DAYS = 365;

async function myQueueCandidates(user: AuthUser) {
  return db.lead.findMany({
    where: { ownerId: user.id, archivedAt: null, status: { notIn: [...FINAL] } },
    select: { id: true, name: true, status: true, priority: true, nextFollowUpAt: true, lastContactedAt: true, createdAt: true },
    take: 500,
  });
}
const toQueue = (rows: Awaited<ReturnType<typeof myQueueCandidates>>): QueueLead[] => rows.map((r) => ({ ...r, priority: r.priority as PriorityKey }));

// ───────────── home ─────────────

export async function getWorkspaceHome(user: AuthUser) {
  assertCan(user, "lead", "VIEW");
  const now = new Date();
  const todayStart = startOfDayIST(now);
  const tomorrowStart = addDays(todayStart, 1);
  const todayDate = new Date(`${dayKeyIST(now)}T00:00:00Z`);
  const mine = { ownerId: user.id, archivedAt: null } as const;
  const finishedToday = { agentId: user.id, createdAt: { gte: todayStart }, status: { notIn: [...OPEN_CALL_STATUSES] } };

  const [byStatus, convertedToday, dueToday, overdue, followUps, attempts, connected, target, candidates] = await Promise.all([
    db.lead.groupBy({ by: ["status"], where: mine, _count: { _all: true } }),
    db.leadActivity.findMany({
      where: { type: "STATUS_CHANGED", createdAt: { gte: todayStart }, data: { path: ["to"], equals: "CONVERTED" }, lead: mine },
      distinct: ["leadId"], select: { leadId: true },
    }),
    db.followUp.count({ where: { ownerId: user.id, status: "PENDING", dueAt: { gte: todayStart, lt: tomorrowStart } } }),
    db.followUp.count({ where: { ownerId: user.id, status: "PENDING", dueAt: { lt: todayStart } } }),
    db.followUp.findMany({
      where: { ownerId: user.id, status: "PENDING", dueAt: { lt: tomorrowStart } }, orderBy: { dueAt: "asc" }, take: 15,
      select: { id: true, dueAt: true, notes: true, lead: { select: { id: true, name: true, leadCode: true, primaryMobile: true } } },
    }),
    db.callLog.count({ where: finishedToday }),
    db.callLog.count({ where: { ...finishedToday, disposition: { isConnected: true } } }),
    // Personal daily call target. Team-level targets are not per-agent, so they are not used here.
    db.target.findFirst({
      where: { userId: user.id, metric: "CALL_ATTEMPTS", period: "DAILY", startsOn: { lte: todayDate }, OR: [{ endsOn: null }, { endsOn: { gte: todayDate } }] },
      orderBy: { startsOn: "desc" },
    }),
    myQueueCandidates(user),
  ]);

  const n = (...s: string[]) => s.reduce((sum, k) => sum + (byStatus.find((g) => g.status === k)?._count._all ?? 0), 0);
  const total = byStatus.reduce((sum, g) => sum + g._count._all, 0);
  const { ranked, held } = rankQueue(toQueue(candidates), now);

  return {
    counts: {
      assigned: total - n(...FINAL), // open leads I own
      newLeads: n("NEW", "ASSIGNED"),
      pending: n("NEW", "ASSIGNED", "ATTEMPTED"),
      interested: n("INTERESTED"),
      converted: n("CONVERTED"),
      convertedToday: convertedToday.length,
      followUpsToday: dueToday, followUpsOverdue: overdue,
    },
    calls: { target: target?.value ?? null, completed: attempts, connected, progress: target ? Math.min(100, Math.round((attempts / target.value) * 100)) : null },
    followUps, queue: ranked.slice(0, 5), eligible: ranked.length, held,
  };
}

/** Next lead to call, never one of `excludeIds`. Returns null when nothing is eligible. */
export async function getNextLeadId(user: AuthUser, excludeIds: string[]): Promise<string | null> {
  assertCan(user, "lead", "VIEW");
  const { ranked } = rankQueue(toQueue(await myQueueCandidates(user)), new Date(), { excludeIds });
  return ranked[0]?.id ?? null;
}

// ───────────── lead workspace ─────────────

export async function getWorkspaceLead(user: AuthUser, id: string) {
  const detail = await getLeadDetail(user, id); // enforces VIEW permission and ownership scope
  const [dispositions, calls, followUps, active] = await Promise.all([
    db.callDisposition.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, key: true, label: true, isConnected: true, requiresFollowUp: true } }),
    db.callLog.findMany({
      where: { leadId: id, dispositionId: { not: null } }, orderBy: { createdAt: "desc" }, take: 6,
      select: { id: true, createdAt: true, durationSec: true, notes: true, agent: { select: { name: true } }, disposition: { select: { label: true } } },
    }),
    db.followUp.findMany({ where: { leadId: id, status: "PENDING" }, orderBy: { dueAt: "asc" }, take: 5, select: { id: true, dueAt: true, notes: true } }),
    db.callLog.findFirst({
      where: {
        leadId: id, agentId: user.id, dispositionId: null,
        OR: [{ providerName: MANUAL, status: "IN_PROGRESS" }, { clientRef: { not: null }, status: { in: [...OPEN_CALL_STATUSES] } }],
      },
      orderBy: { createdAt: "desc" }, select: { providerCallId: true, clientRef: true, startedAt: true, createdAt: true },
    }),
  ]);
  const telephony = await getActiveTelephony();
  return {
    ...detail, dispositions, calls, followUps,
    activeCall: active && (active.clientRef ?? active.providerCallId) ? { callRef: (active.clientRef ?? active.providerCallId)!, startedAt: (active.startedAt ?? active.createdAt).toISOString() } : null,
    telephonyMode: telephony.mode,
  };
}

// ───────────── calling ─────────────

function assertCallable(status: string) {
  if (status === "DND") throw new AppError("CONFLICT", "This customer is marked Do Not Disturb. Ask a manager to review before calling.");
}

/** Records that the agent has started a call. Safe to repeat: the same callRef returns the original start time. */
export async function startCall(user: AuthUser, leadId: string, callRef: string) {
  assertCan(user, "call", "CREATE");
  const lead = await getAccessibleLead(user, leadId);
  assertCallable(lead.status);

  // With a verified provider (or the dev sandbox) the system places the call; otherwise the agent dials from their own phone.
  const telephony = await getActiveTelephony();
  if (telephony.mode !== "manual") {
    const r = await startProviderCall(user, leadId, callRef, telephony);
    return { mode: r.mode, startedAt: r.startedAt };
  }

  const find = () => db.callLog.findUnique({ where: { providerName_providerCallId: { providerName: MANUAL, providerCallId: callRef } } });
  const check = (c: NonNullable<Awaited<ReturnType<typeof find>>>) => {
    if (c.agentId !== user.id || c.leadId !== leadId) throw notFound("Call");
    return c.startedAt ?? c.createdAt;
  };
  const existing = await find();
  if (existing) return { mode: "manual" as const, startedAt: check(existing).toISOString() };
  try {
    const c = await db.callLog.create({
      data: { leadId, agentId: user.id, direction: "OUTBOUND", status: "IN_PROGRESS", providerName: MANUAL, providerCallId: callRef, startedAt: new Date() },
    });
    return { mode: "manual" as const, startedAt: c.startedAt!.toISOString() };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { mode: "manual" as const, startedAt: check((await find())!).toISOString() };
    throw e;
  }
}

/**
 * Saves a call outcome in one transaction: call record, lead status, follow-up and lead timeline.
 * Idempotent per `callRef`, so a double click or a retry after a network error never creates a second call.
 * The duration comes from the on-screen timer (start → save), not from the phone network.
 */
export async function completeCall(user: AuthUser, input: SaveCallInput) {
  assertCan(user, "call", "CREATE");
  const lead = await getAccessibleLead(user, input.leadId);
  assertCallable(lead.status);

  const disp = await db.callDisposition.findFirst({ where: { id: input.dispositionId, isActive: true } });
  if (!disp) throw new AppError("VALIDATION_ERROR", "Choose a call outcome.");

  const now = new Date();
  const dueAt = input.followUpAt ? new Date(input.followUpAt) : null;
  if (dueAt && dueAt.getTime() < now.getTime() - 60_000) throw new AppError("VALIDATION_ERROR", "The follow-up time is in the past.");
  if (dueAt && dueAt.getTime() > now.getTime() + MAX_FOLLOWUP_DAYS * 86_400_000) throw new AppError("VALIDATION_ERROR", "Choose a follow-up within the next year.");
  if (requiresFollowUp(disp) && !dueAt) throw new AppError("VALIDATION_ERROR", "Pick when to call back.");

  const run = () =>
    db.$transaction(async (tx) => {
      const existing =
        (await tx.callLog.findUnique({ where: { clientRef: input.callRef } })) ??
        (await tx.callLog.findUnique({ where: { providerName_providerCallId: { providerName: MANUAL, providerCallId: input.callRef } } }));
      if (existing && (existing.agentId !== user.id || existing.leadId !== lead.id)) throw notFound("Call");
      if (existing?.dispositionId) return { callId: existing.id, alreadySaved: true as const };

      const started = existing?.startedAt ?? null;
      const durationSec = started ? Math.min(4 * 3600, Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000))) : null;
      const manualData = { status: callStatusFor(disp.key, disp.isConnected), dispositionId: disp.id, endedAt: now, durationSec, notes: input.notes ?? null };
      // A call placed through the provider is owned by the provider's webhooks for status, times, duration and recording.
      // The agent's save only adds the outcome and notes (and a provisional status if the provider hasn't reported yet).
      const providerOwned = !!existing && existing.providerName !== MANUAL;
      const data = providerOwned
        ? { dispositionId: disp.id, notes: input.notes ?? null, ...(isTerminal(existing!.status) ? {} : { status: callStatusFor(disp.key, disp.isConnected) }) }
        : manualData;

      let callId: string;
      if (existing) {
        // Compare-and-swap: only the first save of this call can win.
        const won = await tx.callLog.updateMany({ where: { id: existing.id, dispositionId: null }, data });
        if (won.count !== 1) return { callId: existing.id, alreadySaved: true as const };
        callId = existing.id;
      } else {
        callId = (await tx.callLog.create({ data: { ...manualData, leadId: lead.id, agentId: user.id, direction: "OUTBOUND", providerName: MANUAL, providerCallId: input.callRef } })).id;
      }

      // A call on this lead answers any follow-up that was due; then schedule the new one, if any.
      await tx.followUp.updateMany({ where: { leadId: lead.id, ownerId: user.id, status: "PENDING", dueAt: { lte: now } }, data: { status: "COMPLETED", completedAt: now } });
      if (dueAt) await tx.followUp.create({ data: { leadId: lead.id, ownerId: user.id, dueAt, priority: lead.priority, notes: input.nextAction ?? null } });
      const next = await tx.followUp.aggregate({ where: { leadId: lead.id, status: "PENDING" }, _min: { dueAt: true } });

      const newStatus = nextLeadStatus(lead.status as LeadStatusValue, disp.key, disp.setsLeadStatus as LeadStatusValue | null);
      await tx.lead.update({ where: { id: lead.id }, data: { lastContactedAt: now, nextFollowUpAt: next._min.dueAt ?? null, ...(newStatus ? { status: newStatus } : {}) } });
      if (newStatus) {
        await tx.leadActivity.create({ data: { leadId: lead.id, type: "STATUS_CHANGED", actorId: user.id, data: { from: lead.status, to: newStatus, via: "call", callId } } });
      }
      return { callId, alreadySaved: false as const, newStatus, followUpAt: dueAt?.toISOString() ?? null, outcome: disp.label };
    }, { timeout: 15_000 });

  try {
    return await run();
  } catch (e) {
    // Two identical submissions raced to create the same call: the loser just reports the winner's result.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const c = await db.callLog.findUnique({ where: { providerName_providerCallId: { providerName: MANUAL, providerCallId: input.callRef } } });
      if (c && c.agentId === user.id) return { callId: c.id, alreadySaved: true as const };
    }
    throw e;
  }
}
