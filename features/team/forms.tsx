"use client";

import { useFormState } from "react-dom";
import { createEmployeeAction, resetPasswordAction, saveTeamAction, unlockEmployeeAction, updateEmployeeAction } from "@/app/actions/team";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";

type Opt = { id: string; name: string };
export type EmployeeValues = { id?: string; name?: string; email?: string; phone?: string | null; employeeId?: string | null; role?: { key: string }; teamId?: string | null; reportingToId?: string | null; joinedAt?: Date | null; status?: string };

function TempPassword({ pw, email }: { pw: string; email?: string }) {
  return (
    <div role="alert" className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-sm">
      <p className="font-semibold text-amber-900">Temporary password{email ? ` for ${email}` : ""}. Copy it now; it is shown only once.</p>
      <p className="my-2 select-all rounded bg-white px-3 py-2 font-mono text-lg tracking-wider">{pw}</p>
      <p className="text-xs text-amber-900">They must choose their own password at first sign-in. Share it securely (not in a group chat).</p>
    </div>
  );
}

export function EmployeeForm({ mode, v = {}, roles, teams, managers }: { mode: "create" | "edit"; v?: EmployeeValues; roles: { key: string; name: string }[]; teams: Opt[]; managers: Opt[] }) {
  const [created, createAction] = useFormState(createEmployeeAction, undefined);
  const [saved, saveAction] = useFormState(updateEmployeeAction, undefined);
  const state = mode === "create" ? created : saved;
  const action = mode === "create" ? createAction : saveAction;
  const fe = (k: string) => state?.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <div className="md:col-span-2"><FormMessage error={state?.error} success={state?.success} /></div>
      {created?.tempPassword && mode === "create" && <div className="md:col-span-2"><TempPassword pw={created.tempPassword} email={created.email} /></div>}
      <Field label="Full name" name="name" defaultValue={v.name} error={fe("name")} maxLength={100} />
      <Field label="Email (sign-in)" name="email" type="email" defaultValue={v.email} error={fe("email")} />
      <Field label="Mobile" name="phone" type="tel" required={false} defaultValue={v.phone ? v.phone.replace(/^91/, "") : ""} error={fe("phone")} hint="Used by the telephony provider to ring this person first." />
      <Field label="Employee ID" name="employeeId" required={false} defaultValue={v.employeeId ?? ""} error={fe("employeeId")} />
      <SelectField label="Role" name="roleKey" required defaultValue={v.role?.key ?? "TELECALLER"} error={fe("roleKey")} options={roles.map((r) => ({ value: r.key, label: r.name }))} />
      <SelectField label="Team" name="teamId" placeholder="No team" defaultValue={v.teamId ?? ""} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
      <SelectField label="Reports to" name="reportingToId" placeholder="Nobody" defaultValue={v.reportingToId ?? ""} options={managers.filter((m) => m.id !== v.id).map((m) => ({ value: m.id, label: m.name }))} />
      <Field label="Joining date" name="joinedAt" type="date" required={false} defaultValue={v.joinedAt ? v.joinedAt.toISOString().slice(0, 10) : ""} />
      {mode === "edit" && <SelectField label="Status" name="status" required defaultValue={v.status ?? "ACTIVE"} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive (signed out, cannot sign in)" }, { value: "SUSPENDED", label: "Suspended" }]} />}
      <div className="md:w-48"><SubmitButton>{mode === "create" ? "Create employee" : "Save changes"}</SubmitButton></div>
    </form>
  );
}

export function AccountTools({ id }: { id: string }) {
  const [reset, resetAction] = useFormState(resetPasswordAction, undefined);
  const [unlock, unlockAction] = useFormState(unlockEmployeeAction, undefined);
  return (
    <div className="flex flex-col gap-4">
      <form action={resetAction} className="flex flex-col gap-2"><input type="hidden" name="id" value={id} /><div className="w-56"><SubmitButton>Reset password</SubmitButton></div><FormMessage error={reset?.error} success={reset?.success} />{reset?.tempPassword && <TempPassword pw={reset.tempPassword} />}</form>
      <form action={unlockAction} className="flex flex-col gap-2"><input type="hidden" name="id" value={id} /><div className="w-56"><SubmitButton>Unlock account</SubmitButton></div><FormMessage error={unlock?.error} success={unlock?.success} /></form>
    </div>
  );
}

export function TeamForm({ team, people }: { team?: { id: string; name: string; leaderId: string | null }; people: Opt[] }) {
  const [state, action] = useFormState(saveTeamAction, undefined);
  return (
    <form action={action} className="grid gap-3 rounded-card border border-line bg-white p-4 md:grid-cols-4 md:items-end">
      {team && <input type="hidden" name="id" value={team.id} />}
      <Field label="Team name" name="name" defaultValue={team?.name} maxLength={60} />
      <SelectField label="Team leader" name="leaderId" placeholder="No leader" defaultValue={team?.leaderId ?? ""} options={people.map((p) => ({ value: p.id, label: p.name }))} />
      <SubmitButton>{team ? "Save" : "Add team"}</SubmitButton>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
