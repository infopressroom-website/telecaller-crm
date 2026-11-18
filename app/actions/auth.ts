"use server";

import { redirect } from "next/navigation";
import { getClientMeta } from "@/lib/auth/request";
import { rateLimit } from "@/lib/rate-limit";
import { homePathFor } from "@/lib/auth/rbac";
import { destroyCurrentSession, requireUser } from "@/lib/auth/session";
import { changePassword, login, requestPasswordReset, resetPassword } from "@/services/auth-service";
import { audit } from "@/services/audit-service";
import {
  changePasswordSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema,
} from "@/validations/auth";

export type FormState =
  | { error?: string; success?: string; needsConfirm?: boolean; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;

const fields = (fd: FormData) => Object.fromEntries(fd) as Record<string, string>;

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: "Enter a valid email and your password." };

  const meta = getClientMeta();
  const byIp = rateLimit(`login:ip:${meta.ip ?? "?"}`, 30, 10 * 60_000);
  const byEmail = rateLimit(`login:email:${parsed.data.email}`, 10, 10 * 60_000);
  if (!byIp.ok || !byEmail.ok) return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };
  const result = await login(parsed.data, meta);
  if (!result.ok) return { error: result.message };
  redirect(homePathFor({ roleKey: result.roleKey }));
}

export async function logoutAction() {
  const user = await requireUser();
  await destroyCurrentSession();
  await audit({ actorId: user.id, action: "auth.logout", entityType: "User", entityId: user.id, ipAddress: getClientMeta().ip });
  redirect("/login");
}

export async function forgotPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const meta = getClientMeta();
  if (!rateLimit(`forgot:ip:${meta.ip ?? "?"}`, 10, 60 * 60_000).ok) return { error: "Too many requests. Please try again later." };
  await requestPasswordReset(parsed.data.email, meta);
  // Same message whether or not the account exists.
  return { success: "If that email belongs to an active account, a reset link has been sent." };
}

export async function resetPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(fields(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const result = await resetPassword(parsed.data, getClientMeta());
  return result.ok ? { success: result.message } : { error: result.message };
}

export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(fields(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const result = await changePassword(
    { userId: user.id, current: parsed.data.current, next: parsed.data.password, keepSessionId: user.sessionId },
    getClientMeta(),
  );
  return result.ok ? { success: result.message } : { error: result.message };
}
