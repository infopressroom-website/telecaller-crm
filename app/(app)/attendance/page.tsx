import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClockWidget, LeaveForm } from "@/features/attendance/forms";
import { hoursText } from "@/lib/attendance/calc";
import { can } from "@/lib/auth/rbac";
import { requirePagePermission } from "@/lib/auth/session";
import { dayKeyIST } from "@/lib/date-range";
import { getMyToday, listDaily, monthlyReport, myHistory, shiftFormOptions } from "@/services/attendance-service";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";
const time = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default async function AttendancePage({ searchParams }: { searchParams: { date?: string; month?: string } }) {
  const user = await requirePagePermission("attendance", "VIEW");
  const today = dayKeyIST(new Date());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? "") ? searchParams.date! : today;
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? "") ? searchParams.month! : today.slice(0, 7);
  const canClock = can(user, "attendance", "CREATE");
  const isStaffView = user.roleKey !== "TELECALLER";
  const [mine, history, daily, monthly, opts] = await Promise.all([
    canClock ? getMyToday(user) : null, canClock ? myHistory(user, 31) : [], isStaffView ? listDaily(user, date) : [], monthlyReport(user, month),
    can(user, "attendance", "MANAGE") ? shiftFormOptions(user) : null,
  ]);
  return (
    <>
      <PageHeader title={isStaffView ? "Attendance" : "My attendance"} description="Your own clock-in, breaks and leave. Attendance is recorded here, never guessed from calls or browser activity."
        actions={can(user, "attendance", "MANAGE") && <Link href="/attendance/shifts" className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold">Shifts</Link>} />

      {mine && (
        <Card>
          <h2 className="mb-1 text-base font-semibold">Today</h2>
          <p className="mb-3 text-sm text-ink-muted">
            {mine.shift ? `Shift ${mine.shift.name} (${mine.shift.startTime}–${mine.shift.endTime})` : "No shift assigned"}
            {mine.row?.clockInAt ? ` · in at ${time.format(mine.row.clockInAt)}${mine.row.isLate ? " (late)" : ""}` : " · not clocked in"}
            {mine.row?.clockOutAt ? ` · out at ${time.format(mine.row.clockOutAt)}` : ""} · worked {hoursText(mine.workedMin)} · breaks {hoursText(mine.breakMin)}
          </p>
          <ClockWidget clockedIn={mine.clockedIn} clockedOut={mine.clockedOut} onBreak={mine.onBreak} />
        </Card>
      )}

      {isStaffView && (
        <Card>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-base font-semibold">Team on {date}</h2>
            <form method="get" action="/attendance" className="flex items-end gap-2"><label className="flex flex-col gap-1 text-xs font-medium">Date<input type="date" name="date" defaultValue={date} className="h-11 rounded-lg border border-slate-300 px-2 text-sm" /></label><button className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold">Show</button></form>
          </div>
          {daily.length === 0 ? <EmptyState title="No employees to show" /> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead><tr className="border-b border-line text-ink-muted">{["Employee", "Status", "In", "Out", "Worked", "Note"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{daily.map((r) => (
                <tr key={r.userId} className="border-b border-slate-100"><td className="px-3 py-2">{r.name}<div className="text-xs text-ink-muted">{r.team}</div></td>
                  <td className="px-3 py-2">{r.status ? <Badge tone={r.status === "PRESENT" ? "success" : r.status === "ABSENT" ? "danger" : "warning"}>{r.status.replace("_", " ").toLowerCase()}</Badge> : <span className="text-ink-muted">Not clocked in</span>}{r.isLate && <> <Badge tone="warning">late</Badge></>}</td>
                  <td className="px-3 py-2">{r.clockInAt ? time.format(r.clockInAt) : "—"}</td><td className="px-3 py-2">{r.clockOutAt ? time.format(r.clockOutAt) : "—"}</td><td className="px-3 py-2">{r.clockInAt ? hoursText(r.workedMin) : "—"}</td><td className="px-3 py-2 text-xs">{r.notes ?? ""}</td></tr>))}</tbody>
            </table></div>
          )}
        </Card>
      )}

      {opts && <Card><h2 className="mb-3 text-base font-semibold">Mark leave, absence or holiday</h2><LeaveForm people={opts.people} /></Card>}

      <Card>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold">Monthly summary: {month}</h2>
          <form method="get" action="/attendance" className="flex items-end gap-2"><label className="flex flex-col gap-1 text-xs font-medium">Month<input type="month" name="month" defaultValue={month} className="h-11 rounded-lg border border-slate-300 px-2 text-sm" /></label><button className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold">Show</button></form>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b border-line text-ink-muted">{["Employee", "Present", "Half day", "Absent", "Leave", "Late", "Hours worked"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{monthly.map((r) => <tr key={r.name} className="border-b border-slate-100"><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2">{r.present}</td><td className="px-3 py-2">{r.halfDay}</td><td className="px-3 py-2">{r.absent}</td><td className="px-3 py-2">{r.leave}</td><td className="px-3 py-2">{r.late}</td><td className="px-3 py-2">{hoursText(r.workedMin)}</td></tr>)}</tbody>
        </table></div>
      </Card>

      {history.length > 0 && (
        <Card><h2 className="mb-2 text-base font-semibold">My last 31 days</h2>
          <ul className="divide-y divide-slate-100 text-sm">{history.map((h) => <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{dayFmt.format(h.date)} · <Badge tone={h.status === "PRESENT" ? "success" : "neutral"}>{h.status.replace("_", " ").toLowerCase()}</Badge>{h.isLate && <> <Badge tone="warning">late</Badge></>}</span><span className="text-ink-muted">{h.clockInAt ? `${time.format(h.clockInAt)}–${h.clockOutAt ? time.format(h.clockOutAt) : "…"} · ${hoursText(h.workedMin)}` : (h.notes ?? "")}</span></li>)}</ul></Card>
      )}
    </>
  );
}
