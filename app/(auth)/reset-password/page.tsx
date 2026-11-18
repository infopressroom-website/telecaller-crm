import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/features/auth/reset-form";

export const metadata: Metadata = { title: "Set new password" };

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token;
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Set a new password</h1>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <p className="text-sm">
          This reset link is incomplete. <Link href="/forgot-password" className="text-brand-700 underline">Request a new one</Link>.
        </p>
      )}
    </>
  );
}
