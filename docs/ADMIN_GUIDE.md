# Administrator guide

## Roles at a glance
| Role | Can do (summary) |
|---|---|
| Super Admin / Admin | Everything (Admin also views the audit log; only Super Admin creates Admins) |
| Manager | Dashboard, leads (incl. import, assign, export, merge), distribution (run, approve), team view/edit, calls, follow-ups, attendance view, performance (+targets), incentive approval, QA view, reports |
| Team Leader | Dashboard, their team's leads (edit, assign; approvals needed to move owned leads), calls, follow-ups, attendance and performance view, reports |
| QA Manager | Dashboard, calls, QA reviews, performance view, reports |
| HR / Operations | Employees, attendance (all), incentive statements, reports |
| Telecaller | Own leads, workspace, own calls, follow-ups, attendance, performance |
| Viewer | Dashboard and reports (read-only) |
Data scope: Admins see all; Managers see their teams plus unassigned new leads; Team Leaders their teams; Telecallers only what they own.

## Day-one setup order
1. **Settings → Call outcomes:** review the 10 outcomes; add your own.
2. **Team & employees:** create teams, then employees (temporary password shown once; they must change it).
3. **Attendance → Shifts:** create shifts and assign them.
4. **Leads:** add or import leads (CSV/Excel); set sources/campaigns (seeded sample sources exist).
5. **Distribution → Rules and Agents:** create rules, set caps, service areas; preview, then apply.
6. **Performance → Targets, Incentives:** set daily targets, slabs and the conversion bonus.
7. **Automation:** review the starter rules, **Test** each, turn on the ones you want; make sure the scheduler calls the cron URL (Deployment guide).
8. **Settings → Telephony** (optional): follow the test-call steps; add agent mobile numbers.
9. **Settings → AI** (optional).

## Everyday tasks
- **New leads arrive:** Distribution → Preview → Apply (or automate with "New leads waiting → Distribute").
- **Reassign a lead that has an owner:** managers do it directly; team leaders file a request with a reason, a manager approves under Distribution → Approvals.
- **Someone is absent:** HR marks leave/absence in Attendance; managers can run Distribution → "Unworked leads of absent employees".
- **Employee leaves:** Team → Edit → status Inactive (signs them out immediately), then reassign their leads.
- **Locked account / forgotten password:** Team → Edit → Unlock / Reset password.
- **Month-end incentives:** Performance → Incentives: create statements for the period, manager approves, then mark paid.
- **Quality:** QA → To review; reports under Reports.
- **Who did what:** Audit log.

## Safety habits
Never share the temporary password in a group chat; never enable sandbox telephony in production (it is blocked); keep CRON/webhook/AI secrets only in the server environment; review the audit log for exports and recording access; take and test backups.
