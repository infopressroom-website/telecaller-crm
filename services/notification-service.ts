import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/rbac";

export type NotifyInput = { userId: string; title: string; body?: string; link?: string; dedupeKey?: string };

/**
 * Creates an in-app notification. A repeated dedupeKey is silently ignored, which is how automation avoids
 * telling the same person about the same thing twice. Returns false when it was a duplicate.
 * Only in-app delivery is implemented; email, SMS and WhatsApp are NOT wired up (see docs/AUTOMATION.md).
 */
export async function notify(n: NotifyInput): Promise<boolean> {
  try {
    await db.notification.create({
      data: { userId: n.userId, title: n.title.slice(0, 200), body: n.body?.slice(0, 1000) ?? null, link: n.link ?? null, dedupeKey: n.dedupeKey ?? null, channel: "IN_APP", status: "SENT" },
    });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

export const unreadCount = (userId: string) => db.notification.count({ where: { userId, channel: "IN_APP", readAt: null } });

export async function listMyNotifications(user: AuthUser, take = 50) {
  return db.notification.findMany({ where: { userId: user.id, channel: "IN_APP" }, orderBy: { createdAt: "desc" }, take, select: { id: true, title: true, body: true, link: true, readAt: true, createdAt: true } });
}

/** Only ever touches the caller's own notifications. */
export async function markRead(user: AuthUser, ids?: string[]) {
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date(), status: "READ" },
  });
}
