import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type AuditEvent = {
  actorId?: string | null;
  action: string; // e.g. auth.login_locked, auth.password_changed
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

/** Append-only. Never put passwords, tokens or other secrets in before/after. */
export async function audit(e: AuditEvent) {
  await db.auditLog.create({
    data: {
      actorId: e.actorId ?? null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId ?? null,
      before: e.before,
      after: e.after,
      ipAddress: e.ipAddress ?? null,
    },
  });
}

// ───────────── viewing (administrators) ─────────────
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { pageMeta, toPrismaPage } from "@/lib/pagination";

export async function listAudit(user: AuthUser, q: { action?: string; actorQuery?: string; from?: string; to?: string; page: number; pageSize: number }) {
  assertCan(user, "audit", "VIEW");
  const where: Prisma.AuditLogWhereInput = {
    ...(q.action ? { action: { startsWith: q.action } } : {}),
    ...(q.actorQuery ? { actor: { OR: [{ name: { contains: q.actorQuery, mode: "insensitive" } }, { email: { contains: q.actorQuery, mode: "insensitive" } }] } } : {}),
    createdAt: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00+05:30`) } : {}), ...(q.to ? { lt: new Date(new Date(`${q.to}T00:00:00+05:30`).getTime() + 86_400_000) } : {}) },
  };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, ...toPrismaPage(q), select: { id: true, action: true, entityType: true, entityId: true, ipAddress: true, createdAt: true, after: true, actor: { select: { name: true, email: true } } } }),
  ]);
  return { rows, meta: pageMeta(total, q), total };
}
