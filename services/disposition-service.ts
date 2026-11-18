import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, type AuthUser } from "@/lib/auth/rbac";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "./audit-service";
import type { DispositionInput } from "./disposition-schema";


export async function listDispositions(user: AuthUser) {
  assertCan(user, "settings", "MANAGE");
  return db.callDisposition.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
}

export async function saveDisposition(user: AuthUser, input: DispositionInput) {
  assertCan(user, "settings", "MANAGE");
  try {
    if (input.id) {
      const cur = await db.callDisposition.findUnique({ where: { id: input.id } });
      if (!cur) throw notFound("Outcome");
      // Built-in outcomes keep their key (reports and status rules rely on it) and always stay available.
      const data = { label: input.label, isConnected: input.isConnected, isFinal: input.isFinal, requiresFollowUp: input.requiresFollowUp, setsLeadStatus: cur.isSystem ? cur.setsLeadStatus : input.setsLeadStatus, sortOrder: input.sortOrder, isActive: cur.isSystem ? true : input.isActive };
      await db.callDisposition.update({ where: { id: input.id }, data });
      await audit({ actorId: user.id, action: "disposition.update", entityType: "CallDisposition", entityId: input.id, before: { label: cur.label, isConnected: cur.isConnected, isActive: cur.isActive }, after: data });
    } else {
      if (!input.key) throw new AppError("VALIDATION_ERROR", "Enter a key for the new outcome.");
      const d = await db.callDisposition.create({ data: { key: input.key, label: input.label, isConnected: input.isConnected, isFinal: input.isFinal, requiresFollowUp: input.requiresFollowUp, setsLeadStatus: input.setsLeadStatus, sortOrder: input.sortOrder, isActive: input.isActive } });
      await audit({ actorId: user.id, action: "disposition.create", entityType: "CallDisposition", entityId: d.id, after: { key: d.key, label: d.label } });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError("CONFLICT", "An outcome with that key already exists.");
    throw e;
  }
}
