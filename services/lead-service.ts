import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, can, type AuthUser } from "@/lib/auth/rbac";
import { leadWhere } from "@/lib/auth/scope";
import { AppError } from "@/lib/errors";
import { buildLeadWhere, LEAD_ORDER } from "@/lib/leads/query";
import { pageMeta, toPrismaPage } from "@/lib/pagination";
import { FILTER_KEYS, leadListQuerySchema, type LeadInput, type LeadListQuery } from "@/validations/lead";
import { audit } from "./audit-service";
import { nextLeadCodes } from "./lead-code";
import { getDistributionSettings } from "./settings-service";
import { getAccessibleLead, resolveScope } from "./scope-service";
import type { LeadStatusValue } from "@/lib/leads/fields";
import { cacheGet, cacheSet, cacheDelPattern } from "@/lib/redis";

const ASSIGNABLE_ROLES = ["TELECALLER", "TEAM_LEADER"];

// ───────────── reading ─────────────

export async function listLeads(user: AuthUser, q: LeadListQuery) {
  assertCan(user, "lead", "VIEW");
  const scope = await resolveScope(user);
  const { unworkedAfterHours } = await getDistributionSettings();
  const where = buildLeadWhere(scope, q, new Date(), new Date(Date.now() - unworkedAfterHours * 3_600_000));
  
  // Cache lead counts for 1 minute (60 seconds)
  const countCacheKey = `leads:counts:${user.id}:${JSON.stringify(where).slice(0, 100)}`;
  let total: number;
  
  const cachedCount = await cacheGet(countCacheKey);
  if (cachedCount) {
    try {
      total = JSON.parse(cachedCount) as number;
    } catch {
      total = await db.lead.count({ where });
      await cacheSet(countCacheKey, JSON.stringify(total), 60);
    }
  } else {
    total = await db.lead.count({ where });
    await cacheSet(countCacheKey, JSON.stringify(total), 60);
  }
  
  const rows = await db.lead.findMany({
    where,
    orderBy: LEAD_ORDER[q.sort],
    ...toPrismaPage(q),
    select: {
      id: true, leadCode: true, name: true, primaryMobile: true, city: true, status: true, priority: true,
      nextFollowUpAt: true, createdAt: true, score: true,
      owner: { select: { name: true } }, team: { select: { name: true } },
      source: { select: { name: true } }, campaign: { select: { name: true } },
    },
  });
  
  return { rows, total, meta: pageMeta(total, q) };
}

export type TimelineItem = { id: string; at: Date; kind: "activity" | "call" | "assignment" | "followup"; title: string; detail?: string; actor?: string };

const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export async function getLeadDetail(user: AuthUser, id: string) {
  assertCan(user, "lead", "VIEW");
  const base = await getAccessibleLead(user, id);
  const scope = await resolveScope(user);

  const [lead, activities, calls, assignments, followUps, duplicates] = await Promise.all([
    db.lead.findUniqueOrThrow({
      where: { id: base.id },
      include: {
        owner: { select: { id: true, name: true } }, team: { select: { name: true } },
        source: { select: { name: true } }, campaign: { select: { name: true } },
      },
    }),
    db.leadActivity.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { name: true } } } }),
    db.callLog.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 100, include: { agent: { select: { name: true } }, disposition: { select: { label: true } } } }),
    db.leadAssignment.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 100, include: { fromUser: { select: { name: true } }, toUser: { select: { name: true } }, actor: { select: { name: true } } } }),
    db.followUp.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 50, include: { owner: { select: { name: true } } } }),
    // Duplicates are only shown if they're inside the viewer's own scope.
    db.lead.findMany({
      where: { AND: [leadWhere(scope), { primaryMobile: base.primaryMobile, id: { not: id } }] },
      select: { id: true, leadCode: true, name: true, status: true, createdAt: true },
      take: 10,
    }),
  ]);

  const timeline: TimelineItem[] = [
    ...activities.map((a): TimelineItem => {
      const d = (a.data ?? {}) as { from?: string; to?: string; changes?: Record<string, unknown> };
      const title =
        a.type === "STATUS_CHANGED" ? `Status: ${label(d.from ?? "?")} → ${label(d.to ?? "?")}`
        : a.type === "UPDATED" ? "Details updated"
        : a.type === "NOTE" ? "Note added"
        : a.type === "MERGED" ? "Duplicate merged in"
        : a.type === "IMPORTED" ? "Imported"
        : a.type === "FOLLOWUP" ? "Follow-up"
        : "Lead created";
      const detail = a.type === "UPDATED" && d.changes ? `Changed: ${Object.keys(d.changes).join(", ")}` : (a.message ?? undefined);
      return { id: `a-${a.id}`, at: a.createdAt, kind: "activity", title, detail, actor: a.actor?.name };
    }),
    ...calls.map((c): TimelineItem => ({
      id: `c-${c.id}`, at: c.createdAt, kind: "call",
      title: `Call: ${c.disposition?.label ?? label(c.status)}`,
      detail: [c.durationSec ? `${c.durationSec}s` : null, c.notes].filter(Boolean).join(" · ") || undefined,
      actor: c.agent.name,
    })),
    ...assignments.map((a): TimelineItem => ({
      id: `s-${a.id}`, at: a.createdAt, kind: "assignment",
      title: `Assigned ${a.fromUser ? `${a.fromUser.name} → ` : "to "}${a.toUser?.name ?? "nobody"}`,
      detail: [label(a.method), a.reason].filter(Boolean).join(" · "), actor: a.actor?.name,
    })),
    ...followUps.map((f): TimelineItem => ({
      id: `f-${f.id}`, at: f.createdAt, kind: "followup",
      title: `Follow-up (${label(f.status)})`, detail: `Due ${f.dueAt.toISOString().slice(0, 16).replace("T", " ")} UTC`, actor: f.owner.name,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 150);

  return { lead, timeline, duplicates };
}

export async function getLeadFormOptions(user: AuthUser) {
  const scope = await resolveScope(user);
  const [sources, campaigns, assignable] = await Promise.all([
    db.leadSource.findMany({ where: { archivedAt: null, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.campaign.findMany({ where: { archivedAt: null, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    can(user, "lead", "ASSIGN") ? listAssignableUsers(user) : Promise.resolve([]),
  ]);
  const teams = scope.kind === "ALL" || scope.kind === "TEAMS"
    ? await db.team.findMany({ where: { archivedAt: null, ...(scope.kind === "TEAMS" ? { id: { in: scope.teamIds } } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  return { sources, campaigns, assignable, teams };
}

async function listAssignableUsers(user: AuthUser) {
  const scope = await resolveScope(user);
  if (scope.kind === "OWN" || scope.kind === "NONE") return [];
  return db.user.findMany({
    where: {
      status: "ACTIVE", archivedAt: null, role: { key: { in: ASSIGNABLE_ROLES } },
      ...(scope.kind === "TEAMS" ? { OR: [{ id: user.id }, { teamId: { in: scope.teamIds } }] } : {}),
    },
    select: { id: true, name: true, team: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

// ───────────── writing ─────────────

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; duplicate: { total: number; visible: { id: string; leadCode: string; name: string }[] } };

export async function createLead(user: AuthUser, input: LeadInput, confirmDuplicate: boolean): Promise<CreateResult> {
  assertCan(user, "lead", "CREATE");
  const scope = await resolveScope(user);

  if (!confirmDuplicate) {
    const [total, visible] = await Promise.all([
      db.lead.count({ where: { primaryMobile: input.primaryMobile, archivedAt: null } }),
      db.lead.findMany({ where: { AND: [leadWhere(scope), { primaryMobile: input.primaryMobile }] }, select: { id: true, leadCode: true, name: true }, take: 3 }),
    ]);
    if (total > 0) return { ok: false, duplicate: { total, visible } };
  }

  const id = randomUUID();
  await db.$transaction(async (tx) => {
    const [code] = await nextLeadCodes(tx, 1);
    await tx.lead.create({
      data: {
        id, leadCode: code!, name: input.name, primaryMobile: input.primaryMobile,
        alternateMobile: input.alternateMobile ?? null, email: input.email ?? null, city: input.city ?? null,
        state: input.state ?? null, sourceId: input.sourceId ?? null, campaignId: input.campaignId ?? null,
        priority: input.priority, notes: input.notes ?? null,
      },
    });
    await tx.leadActivity.create({ data: { leadId: id, type: "CREATED", actorId: user.id, message: confirmDuplicate ? "Created (duplicate mobile confirmed)" : null } });
  });
  await audit({ actorId: user.id, action: "lead.create", entityType: "Lead", entityId: id });
  
  // Invalidate lead count caches
  await cacheDelPattern("leads:counts:*");
  
  return { ok: true, id };
}

export async function updateLead(user: AuthUser, id: string, input: LeadInput) {
  assertCan(user, "lead", "EDIT");
  const lead = await getAccessibleLead(user, id);
  const fullEdit = can(user, "lead", "CREATE"); // telecallers may only touch contact details and priority

  const next: Record<string, string | null> = {
    alternateMobile: input.alternateMobile ?? null, email: input.email ?? null, city: input.city ?? null,
    state: input.state ?? null, priority: input.priority,
  };
  if (fullEdit) {
    Object.assign(next, {
      name: input.name, primaryMobile: input.primaryMobile, notes: input.notes ?? null,
      sourceId: input.sourceId ?? null, campaignId: input.campaignId ?? null,
    });
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(next)) {
    const cur = (lead as Record<string, unknown>)[k] ?? null;
    if (cur !== v) changes[k] = { from: cur, to: v };
  }
  if (Object.keys(changes).length === 0) return;

  await db.$transaction([
    db.lead.update({ where: { id }, data: next as Prisma.LeadUncheckedUpdateInput }),
    db.leadActivity.create({ data: { leadId: id, type: "UPDATED", actorId: user.id, data: { changes } as Prisma.InputJsonValue } }),
  ]);
  
  // Invalidate lead count caches
  await cacheDelPattern("leads:counts:*");
}

export async function changeStatus(user: AuthUser, id: string, status: LeadStatusValue) {
  assertCan(user, "lead", "EDIT");
  const lead = await getAccessibleLead(user, id);
  if (lead.status === status) return;
  await db.$transaction([
    db.lead.update({ where: { id }, data: { status } }),
    db.leadActivity.create({ data: { leadId: id, type: "STATUS_CHANGED", actorId: user.id, data: { from: lead.status, to: status } } }),
  ]);
  
  // Invalidate lead count caches
  await cacheDelPattern("leads:counts:*");
}

export async function addNote(user: AuthUser, id: string, message: string) {
  assertCan(user, "lead", "EDIT");
  await getAccessibleLead(user, id);
  await db.leadActivity.create({ data: { leadId: id, type: "NOTE", actorId: user.id, message } });
}

// ───────────── bulk operations ─────────────

async function scopedLeads(user: AuthUser, ids: string[]) {
  const scope = await resolveScope(user);
  return db.lead.findMany({ where: { AND: [{ id: { in: ids } }, leadWhere(scope)] }, select: { id: true, ownerId: true, status: true } });
}

/**
 * Manual assignment. Unassigned leads are assigned straight away. Leads that already have an owner are only
 * moved directly by people who can approve reassignments; everyone else files a request (reason required).
 * Every move is a compare-and-swap on the current owner, so a lead changed by someone else meanwhile is skipped.
 */
export async function bulkAssign(user: AuthUser, ids: string[], ownerId: string, reason?: string) {
  assertCan(user, "lead", "ASSIGN");
  const allowed = await listAssignableUsers(user);
  const target = allowed.find((u) => u.id === ownerId);
  if (!target) throw new AppError("VALIDATION_ERROR", "That person can't receive these leads.");
  const targetFull = await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { teamId: true } });

  const leads = (await scopedLeads(user, ids)).filter((l) => l.ownerId !== ownerId);
  const canMoveOwned = can(user, "distribution", "APPROVE");
  const direct = leads.filter((l) => !l.ownerId || canMoveOwned);
  const needApproval = leads.filter((l) => l.ownerId && !canMoveOwned);
  if (needApproval.length > 0 && !(reason && reason.trim().length >= 3)) {
    throw new AppError("VALIDATION_ERROR", `${needApproval.length} of these leads already have an owner. Moving them needs approval, so please enter a reason.`);
  }

  let assigned = 0;
  await db.$transaction(async (tx) => {
    for (const l of direct) {
      const res = await tx.lead.updateMany({
        where: { id: l.id, ownerId: l.ownerId, archivedAt: null },
        data: { ownerId, teamId: targetFull.teamId, ...(l.status === "NEW" ? { status: "ASSIGNED" as const } : {}) },
      });
      if (res.count !== 1) continue; // changed by someone else meanwhile
      assigned++;
      await tx.leadAssignment.create({
        data: { leadId: l.id, fromUserId: l.ownerId, toUserId: ownerId, actorId: user.id, method: l.ownerId ? "REASSIGNMENT" : "MANUAL", reason: reason?.trim() || null },
      });
    }
  }, { timeout: 60_000 });

  let requested = 0;
  if (needApproval.length) {
    const res = await db.reassignmentRequest.createMany({
      data: needApproval.map((l) => ({ leadId: l.id, fromUserId: l.ownerId, toUserId: ownerId, requestedById: user.id, reason: reason!.trim(), pendingKey: l.id })),
      skipDuplicates: true, // an open request for the same lead already exists
    });
    requested = res.count;
  }
  await audit({ actorId: user.id, action: "lead.bulk_assign", entityType: "Lead", after: { assigned, requested, ownerId } });
  return { assigned, requested, skipped: ids.length - assigned - requested };
}

export async function bulkStatus(user: AuthUser, ids: string[], status: LeadStatusValue) {
  assertCan(user, "lead", "EDIT");
  const leads = (await scopedLeads(user, ids)).filter((l) => l.status !== status);
  if (leads.length === 0) return { updated: 0, skipped: ids.length };
  await db.$transaction([
    db.lead.updateMany({ where: { id: { in: leads.map((l) => l.id) } }, data: { status } }),
    db.leadActivity.createMany({ data: leads.map((l) => ({ leadId: l.id, type: "STATUS_CHANGED" as const, actorId: user.id, data: { from: l.status, to: status } })) }),
  ]);
  await audit({ actorId: user.id, action: "lead.bulk_status", entityType: "Lead", after: { count: leads.length, status } });
  return { updated: leads.length, skipped: ids.length - leads.length };
}

// ───────────── merge ─────────────

/** Moves history from `source` onto `target` and archives `source`. Nothing is deleted. */
export async function mergeLeads(user: AuthUser, targetId: string, sourceId: string) {
  assertCan(user, "lead", "MANAGE");
  if (targetId === sourceId) throw new AppError("VALIDATION_ERROR", "Pick two different leads.");
  const [target, source] = await Promise.all([getAccessibleLead(user, targetId), getAccessibleLead(user, sourceId)]);
  if (target.mergedIntoId || source.mergedIntoId) throw new AppError("CONFLICT", "One of these leads was already merged.");

  const callIds = (await db.callLog.findMany({ where: { leadId: sourceId }, select: { id: true }, take: 500 })).map((c) => c.id);
  const moved = await db.$transaction(async (tx) => {
    const calls = await tx.callLog.updateMany({ where: { leadId: sourceId }, data: { leadId: targetId } });
    const followUps = await tx.followUp.updateMany({ where: { leadId: sourceId }, data: { leadId: targetId } });
    const tasks = await tx.task.updateMany({ where: { leadId: sourceId }, data: { leadId: targetId } });
    const assignments = await tx.leadAssignment.updateMany({ where: { leadId: sourceId }, data: { leadId: targetId } });
    const activities = await tx.leadActivity.updateMany({ where: { leadId: sourceId }, data: { leadId: targetId } });
    await tx.lead.update({
      where: { id: targetId },
      data: {
        alternateMobile: target.alternateMobile ?? source.alternateMobile, email: target.email ?? source.email,
        city: target.city ?? source.city, state: target.state ?? source.state,
        sourceId: target.sourceId ?? source.sourceId, campaignId: target.campaignId ?? source.campaignId,
      },
    });
    await tx.lead.update({ where: { id: sourceId }, data: { archivedAt: new Date(), mergedIntoId: targetId, ownerId: null } });
    const counts = { calls: calls.count, followUps: followUps.count, tasks: tasks.count, assignments: assignments.count, activities: activities.count };
    await tx.leadActivity.create({
      data: {
        leadId: targetId, type: "MERGED", actorId: user.id,
        message: `Merged ${source.leadCode} (${source.name}) into this lead`,
        data: { sourceId, sourceCode: source.leadCode, moved: counts, movedCallIds: callIds },
      },
    });
    return counts;
  }, { timeout: 30_000 });
  await audit({ actorId: user.id, action: "lead.merge", entityType: "Lead", entityId: targetId, before: { sourceId, sourceCode: source.leadCode }, after: moved });
}

// ───────────── saved views ─────────────

export async function listSavedViews(user: AuthUser) {
  return db.savedView.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true, filters: true } });
}

export async function saveView(user: AuthUser, name: string, query: LeadListQuery) {
  assertCan(user, "lead", "VIEW");
  if ((await db.savedView.count({ where: { userId: user.id } })) >= 20) throw new AppError("CONFLICT", "You can keep up to 20 saved views. Delete one first.");
  const filters = Object.fromEntries(FILTER_KEYS.filter((k) => query[k] !== undefined).map((k) => [k, query[k]]));
  await db.savedView.upsert({
    where: { userId_name: { userId: user.id, name } },
    create: { userId: user.id, name, filters: filters as Prisma.InputJsonValue },
    update: { filters: filters as Prisma.InputJsonValue },
  });
}

export async function deleteView(user: AuthUser, id: string) {
  await db.savedView.deleteMany({ where: { id, userId: user.id } }); // only your own
}

/** Re-validates stored filters so an old or tampered view can't inject anything. */
export function viewToParams(filters: unknown): URLSearchParams {
  const parsed = leadListQuerySchema.partial().safeParse(filters);
  const params = new URLSearchParams();
  if (!parsed.success) return params;
  for (const k of FILTER_KEYS) {
    const v = parsed.data[k];
    if (v !== undefined) params.set(k, String(v));
  }
  return params;
}
