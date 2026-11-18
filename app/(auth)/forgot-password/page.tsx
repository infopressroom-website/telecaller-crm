import type { Metadata } from "next";
import { ForgotForm } from "@/features/auth/forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Reset your password</h1>
      <p className="mb-4 text-sm text-ink-muted">Enter your work email and we&apos;ll send a reset link.</p>
      <ForgotForm />
    </>
  );
}
