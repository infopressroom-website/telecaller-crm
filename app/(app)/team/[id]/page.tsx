import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AccountTools, EmployeeForm } from "@/features/team/forms";
import { requirePagePermission } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getEmployee, getEmployeeFormOptions } from "@/services/employee-service";

export const metadata: Metadata = { title: "Edit employee" };
export const dynamic = "force-dynamic";

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission("user", "EDIT");
  let e;
  try { e = await getEmployee(user, params.id); } catch (err) { if (err instanceof AppError && err.code === "NOT_FOUND") notFound(); throw err; }
  const o = await getEmployeeFormOptions(user);
  // The current role must stay selectable even if the editor couldn't assign it (they just can't change it).
  const roles = o.roles.some((r) => r.key === e.role.key) ? o.roles : [...o.roles, { key: e.role.key, name: e.role.name }];
  return (
    <>
      <PageHeader title={e.name} description={e.email} />
      <Card><EmployeeForm mode="edit" v={e} roles={roles} teams={o.teams} managers={o.managers} /></Card>
      {user.id !== e.id && <Card><h2 className="mb-3 text-base font-semibold">Account tools</h2><AccountTools id={e.id} /></Card>}
    </>
  );
}
