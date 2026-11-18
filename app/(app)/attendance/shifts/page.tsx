import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AssignShiftForm, ShiftForm } from "@/features/attendance/forms";
import { requirePagePermission } from "@/lib/auth/session";
import { listShifts, shiftFormOptions } from "@/services/attendance-service";

export const metadata: Metadata = { title: "Shifts" };
export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const user = await requirePagePermission("attendance", "MANAGE");
  const [shifts, opts] = await Promise.all([listShifts(user), shiftFormOptions(user)]);
  return (
    <>
      <PageHeader title="Shifts" description="Times are India time. Clocking in later than start + grace is flagged as late." />
      <Card><h2 className="mb-3 text-base font-semibold">Add a shift</h2><ShiftForm /></Card>
      <div className="flex flex-col gap-3">{shifts.map((s) => <div key={s.id}><p className="mb-1 text-xs text-ink-muted">{s._count.users} assignment(s)</p><ShiftForm shift={s} /></div>)}</div>
      <Card><h2 className="mb-3 text-base font-semibold">Assign a shift</h2><AssignShiftForm people={opts.people} shifts={opts.shifts} /></Card>
    </>
  );
}
