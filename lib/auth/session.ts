import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Action, Resource, RoleKey } from "@/lib/permissions";
import {
  SESSION_ABSOLUTE_MS, SESSION_COOKIE, SESSION_IDLE_MS, SESSION_TOUCH_MS,
} from "./constants";
import { can, permKey, type AuthUser } from "./rbac";
import type { ClientMeta } from "./request";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, meta: ClientMeta) {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_MS),
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_ABSOLUTE_MS / 1000,
  });
}

/** Validates the cookie against the database on every call (cached per request). */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });
  if (!session || session.revokedAt) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) return null;
  if (now - session.lastSeenAt.getTime() > SESSION_IDLE_MS) return null;

  const u = session.user;
  // Deactivation takes effect immediately, even for sessions that are still valid.
  if (u.status !== "ACTIVE" || u.archivedAt) return null;

  if (now - session.lastSeenAt.getTime() > SESSION_TOUCH_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    roleKey: u.role.key as RoleKey,
    roleName: u.role.name,
    teamId: u.teamId,
    sessionId: session.id,
    mustChangePassword: u.mustChangePassword,
    permissions: new Set(u.role.permissions.map((rp) => permKey(rp.permission.resource, rp.permission.action))),
  };
});

export async function revokeSessions(userId: string, exceptSessionId?: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null, id: { not: exceptSessionId } },
    data: { revokedAt: new Date() },
  });
}

export async function destroyCurrentSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookies().delete(SESSION_COOKIE);
}

// ---- guards ----

/** For pages/layouts: redirects to /login when not signed in. */
export async function requireUser(opts: { allowMustChange?: boolean } = {}): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // A temporary password must be replaced before anything else can be used.
  if (user.mustChangePassword && !opts.allowMustChange) redirect("/change-password");
  return user;
}

/** For pages/layouts: redirects to /forbidden when the permission is missing. */
export async function requirePagePermission(resource: Resource, action: Action): Promise<AuthUser> {
  const user = await requireUser();
  if (!can(user, resource, action)) redirect("/forbidden");
  return user;
}

/** For API route handlers: throws AppError (401/403) handled by route(). */
export async function requireApiPermission(resource: Resource, action: Action): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  if (!can(user, resource, action)) throw new AppError("FORBIDDEN", "You do not have permission to do this");
  return user;
}
