"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { loginAction } from "@/app/actions/auth";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm() {
  const [state, action] = useFormState(loginAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage error={state?.error} />
      <Field label="Email" name="email" type="email" autoComplete="username" />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      <SubmitButton>Sign in</SubmitButton>
      <Link href="/forgot-password" className="text-center text-sm text-brand-700 underline">Forgot password?</Link>
    </form>
  );
}
