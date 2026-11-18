import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { LOCK_MINUTES, MAX_FAILED_LOGINS, RESET_TOKEN_MS } from "@/lib/auth/constants";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/auth/password";
import type { ClientMeta } from "@/lib/auth/request";
import { createSession, hashToken, revokeSessions } from "@/lib/auth/session";
import type { RoleKey } from "@/lib/permissions";
import { audit } from "./audit-service";

const GENERIC_LOGIN_ERROR = "Invalid email or password.";

type LoginResult = { ok: true; roleKey: RoleKey } | { ok: false; message: string };

async function recordLogin(
  email: string, userId: string | null, success: boolean, reason: string | null, meta: ClientMeta,
) {
  await db.loginHistory.create({
    data: { email, userId, success, reason, ipAddress: meta.ip, userAgent: meta.userAgent },
  });
}

export async function login(input: { email: string; password: string }, meta: ClientMeta): Promise<LoginResult> {
  const user = await db.user.findUnique({ where: { email: input.email }, include: { role: true } });

  if (!user) {
    await burnPasswordCheck(input.password);
    await recordLogin(input.email, null, false, "unknown_user", meta);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordLogin(input.email, user.id, false, "locked", meta);
    return { ok: false, message: "Too many failed attempts. Please try again later." };
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: lock
        ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
        : { failedLogins: failed },
    });
    await recordLogin(input.email, user.id, false, "bad_password", meta);
    if (lock) {
      await audit({ actorId: user.id, action: "auth.account_locked", entityType: "User", entityId: user.id, ipAddress: meta.ip });
    }
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  // Checked after the password so wrong guesses never reveal that an account is inactive.
  if (user.status !== "ACTIVE" || user.archivedAt) {
    await recordLogin(input.email, user.id, false, "inactive", meta);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id, meta);
  await recordLogin(input.email, user.id, true, null, meta);
  return { ok: true, roleKey: user.role.key as RoleKey };
}

export async function changePassword(
  input: { userId: string; current: string; next: string; keepSessionId: string },
  meta: ClientMeta,
): Promise<{ ok: boolean; message: string }> {
  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user || !(await verifyPassword(input.current, user.passwordHash))) {
    return { ok: false, message: "Your current password is incorrect." };
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.next), mustChangePassword: false } });
  await revokeSessions(user.id, input.keepSessionId); // sign out every other device
  await audit({ actorId: user.id, action: "auth.password_changed", entityType: "User", entityId: user.id, ipAddress: meta.ip });
  return { ok: true, message: "Password updated. Other devices have been signed out." };
}

/**
 * Always returns normally so callers can show one neutral message (no account enumeration).
 * No email provider is wired up yet: in development the link is printed to the server console;
 * in production nothing is sent until email delivery is configured.
 */
export async function requestPasswordReset(email: string, meta: ClientMeta): Promise<void> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE" || user.archivedAt) return;

  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_MS) },
    }),
  ]);
  await audit({ actorId: user.id, action: "auth.password_reset_requested", entityType: "User", entityId: user.id, ipAddress: meta.ip });

  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  if (process.env.NODE_ENV !== "production") console.log(`[dev] Password reset link for ${email}: ${link}`);
  else console.warn("Password reset requested but email delivery is not configured.");
}

export async function resetPassword(
  input: { token: string; password: string }, meta: ClientMeta,
): Promise<{ ok: boolean; message: string }> {
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: { user: true },
  });
  const invalid = { ok: false, message: "This reset link is invalid or has expired." };
  if (!record || record.usedAt || record.expiresAt < new Date()) return invalid;
  if (record.user.status !== "ACTIVE" || record.user.archivedAt) return invalid;

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(input.password), failedLogins: 0, lockedUntil: null, mustChangePassword: false },
    }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  await revokeSessions(record.userId);
  await audit({ actorId: record.userId, action: "auth.password_reset_completed", entityType: "User", entityId: record.userId, ipAddress: meta.ip });
  return { ok: true, message: "Password updated. You can now sign in." };
}
