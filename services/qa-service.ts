import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { callScopeWhere } from "@/lib/auth/scope";
import { AppError } from "@/lib/errors";
import { pageMeta, toPrismaPage } from "@/lib/pagination";
import { computeScore, type Ratings } from "@/lib/qa/scorecard";
import { audit } from "./audit-service";
import { getCall } from "./call-service";
import { resolveScope } from "./scope-service";

export async function listQueue(user: AuthUser, q: { agentId?: string; page: number; pageSize: number }) {
  assertCan(user, "qa", "VIEW");
  const scope = await resolveScope(user);
  const where: Prisma.CallLogWhereInput = { AND: [callScopeWhere(scope), { dispositionId: { not: null }, qaReviews: { none: {} }, providerName: { not: "sandbox" } }, q.agentId ? { agentId: q.agentId } : {}] };
  const [total, rows] = await Promise.all([
    db.callLog.count({ where }),
    db.callLog.findMany({
      where, orderBy: [{ recording: { id: "desc" } }, { createdAt: "desc" }], ...toPrismaPage(q),
      select: { id: true, createdAt: true, durationSec: true, lead: { select: { name: true, leadCode: true } }, agent: { select: { name: true } }, disposition: { select: { label: true } }, recording: { select: { id: true } } },
    }),
  ]);
  return { rows, meta: pageMeta(total, q), total };
}

export async function listReviews(user: AuthUser, q: { agentId?: string; page: number; pageSize: number }) {
  assertCan(user, "qa", "VIEW");
  const scope = await resolveScope(user);
  const where: Prisma.QaReviewWhereInput = { AND: [{ call: callScopeWhere(scope) }, q.agentId ? { agentId: q.agentId } : {}] };
  const [total, rows] = await Promise.all([
    db.qaReview.count({ where }),
    db.qaReview.findMany({ where, orderBy: { createdAt: "desc" }, ...toPrismaPage(q), select: { id: true, score: true, createdAt: true, feedback: true, callId: true, agent: { select: { name: true } }, reviewer: { select: { name: true } } } }),
  ]);
  return { rows, meta: pageMeta(total, q), total };
}

export async function qaAgentOptions(user: AuthUser) {
  assertCan(user, "qa", "VIEW");
  const scope = await resolveScope(user);
  if (scope.kind === "OWN" || scope.kind === "NONE") return [];
  return db.user.findMany({ where: { role: { key: "TELECALLER" }, status: "ACTIVE", ...(scope.kind === "TEAMS" ? { OR: [{ id: user.id }, { teamId: { in: scope.teamIds } }] } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 });
}

export async function getReviewContext(user: AuthUser, callId: string) {
  assertCan(user, "qa", "VIEW");
  const { call, canPlayRecording } = await getCall(user, callId); // enforces data scope
  const [review, transcript, analyses] = await Promise.all([
    db.qaReview.findFirst({ where: { callId }, include: { reviewer: { select: { name: true } } } }),
    db.callTranscript.findUnique({ where: { callId } }),
    db.callAnalysis.findMany({ where: { callId }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  return { call, canPlayRecording, review, transcript, analyses };
}

export async function createReview(user: AuthUser, callId: string, ratings: Ratings, feedback: string, coachingNotes: string) {
  assertCan(user, "qa", "CREATE");
  const { call } = await getCall(user, callId);
  if (call.agent && (await db.callLog.findUnique({ where: { id: callId }, select: { agentId: true } }))?.agentId === user.id) throw new AppError("FORBIDDEN", "You can't review your own call.");
  if (await db.qaReview.findFirst({ where: { callId } })) throw new AppError("CONFLICT", "This call has already been reviewed.");
  const score = computeScore(ratings);
  if (score === null) throw new AppError("VALIDATION_ERROR", "Rate every criterion.");
  const agentId = (await db.callLog.findUniqueOrThrow({ where: { id: callId }, select: { agentId: true } })).agentId;
  const r = await db.qaReview.create({ data: { callId, agentId, reviewerId: user.id, score, scorecard: ratings as Prisma.InputJsonValue, feedback: feedback || null, coachingNotes: coachingNotes || null } });
  await audit({ actorId: user.id, action: "qa.review", entityType: "QaReview", entityId: r.id, after: { callId, score } });
  return r.id;
}
