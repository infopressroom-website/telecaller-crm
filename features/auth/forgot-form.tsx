"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { forgotPasswordAction } from "@/app/actions/auth";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function ForgotForm() {
  const [state, action] = useFormState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage error={state?.error} success={state?.success} />
      <Field label="Email" name="email" type="email" autoComplete="username" />
      <SubmitButton>Send reset link</SubmitButton>
      <Link href="/login" className="text-center text-sm text-brand-700 underline">Back to sign in</Link>
    </form>
  );
}
