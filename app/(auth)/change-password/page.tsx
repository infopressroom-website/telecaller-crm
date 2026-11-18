import type { Metadata } from "next";
import Link from "next/link";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { homePathFor } from "@/lib/auth/rbac";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowMustChange: true });
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Change password</h1>
      <ChangePasswordForm />
      <Link href={homePathFor(user)} className="mt-4 block text-center text-sm text-brand-700 underline">Back to app</Link>
    </>
  );
}
