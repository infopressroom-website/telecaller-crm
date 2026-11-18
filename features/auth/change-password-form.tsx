"use client";

import { useFormState } from "react-dom";
import { changePasswordAction } from "@/app/actions/auth";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function ChangePasswordForm() {
  const [state, action] = useFormState(changePasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage error={state?.error} success={state?.success} />
      <Field label="Current password" name="current" type="password" autoComplete="current-password" error={state?.fieldErrors?.current?.[0]} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" error={state?.fieldErrors?.password?.[0]} hint="At least 10 characters with upper case, lower case and a number." />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" error={state?.fieldErrors?.confirm?.[0]} />
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}
