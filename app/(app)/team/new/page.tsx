import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmployeeForm } from "@/features/team/forms";
import { requirePagePermission } from "@/lib/auth/session";
import { getEmployeeFormOptions } from "@/services/employee-service";

export const metadata: Metadata = { title: "Add employee" };

export default async function NewEmployeePage() {
  const user = await requirePagePermission("user", "CREATE");
  const o = await getEmployeeFormOptions(user);
  return (<><PageHeader title="Add employee" description="A temporary password is generated and shown once. The employee must change it at first sign-in." /><Card><EmployeeForm mode="create" {...o} /></Card></>);
}
