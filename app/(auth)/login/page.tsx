import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { homePathFor } from "@/lib/auth/rbac";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Sign in</h1>
      <LoginForm />
    </>
  );
}
