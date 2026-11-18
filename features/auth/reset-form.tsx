"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { resetPasswordAction } from "@/app/actions/auth";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useFormState(resetPasswordAction, undefined);
  if (state?.success) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage success={state.success} />
        <Link href="/login" className="text-center text-sm text-brand-700 underline">Go to sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage error={state?.error} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" error={state?.fieldErrors?.password?.[0]} hint="At least 10 characters with upper case, lower case and a number." />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" error={state?.fieldErrors?.confirm?.[0]} />
      <SubmitButton>Set new password</SubmitButton>
    </form>
  );
}
