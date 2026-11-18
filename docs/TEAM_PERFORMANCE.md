# Team, attendance, performance and incentives (Phase 10)

## Employees (`/team`)
Admins and HR see everyone; managers and team leaders see their teams. Create, edit, deactivate, reset password, unlock.
- **Temporary passwords:** generated, shown once to the administrator, stored only as a hash, and the user **must change it at first sign-in** (every page redirects to change-password until they do). Reset and deactivation sign the user out of all devices immediately.
- **Role rules (server-enforced):** Super Admin can assign any role; Admin any except Admin/Super Admin; HR only Team Leader, Telecaller, Viewer. You can only edit users whose role you could assign. You can't change your own role or deactivate yourself.
- Teams (`/team/teams`): name and leader.
- Every change is audited.

## Attendance (`/attendance`)
- Employees clock in/out and start/end breaks. **Attendance is only what they record**: it is never inferred from calls or browser activity.
- Late = clock-in after shift start + grace (India time). Working time = clock-in to clock-out minus breaks.
- HR/admin mark leave, absence, half day or holiday for up to 31 days at a time (a real clock-in is never overwritten). Shifts and shift assignment at `/attendance/shifts`. Monthly summary per employee.
- Absence/leave feeds distribution (absent agents get no new leads) and the "employee absent" automation trigger.

## Live team status (`/team/live`)
Available / On call / On break / Offline / On leave, from clock-in, breaks, leave and calls in progress (refreshes every 30 s). There is deliberately **no "Away"** status: browser inactivity is not proof someone isn't working.

## Performance (`/performance`)
Per telecaller for the chosen period: calls, connected, connect rate, interested leads, follow-ups done, conversions, conversion rate, average talk time, QA score, and call-target achievement when the period matches the target's period. Ordered by **conversions**, never by call volume alone. Definitions are on the page and in `METRICS.md`. Telecallers see only themselves plus feedback on their reviewed calls.

## Targets (`/performance/targets`)
Per person or per team; measures: call attempts, connected calls, interested leads, conversions, follow-ups completed; daily/weekly (Mon–Sun)/monthly. Progress is shown for the current window.

## Incentives (`/performance/incentives`)
- Admin defines **slabs** (per measure: from/to value → amount) and a **bonus per conversion**.
- HR/admin **create statements** for a period (one per telecaller, skipping duplicates and zero amounts). Each statement stores the exact calculation lines, so any amount can be traced.
- A manager **approves or rejects**; approved statements can be **marked paid**. Nobody can approve their own. Every decision is audited. Money is held in paise.

## Known gaps
1. No payroll integration, tax, or payout; "paid" is a manual mark.
2. Weekly target comparison on the performance page is approximate for "last 7 days".
3. Leave is marked by HR; there is no leave-request/approval workflow or leave balances.
4. No automatic "mark absent if not clocked in" (risk of false absences); HR marks it.
5. Shift times are India time; no overnight-shift handling.
6. Not run against a real database; unit tests cover the pure maths (late arrival, worked time, periods, incentive slabs, role rules, temp passwords).
