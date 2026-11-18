# Lead distribution (Phase 06)

## Pages
| Path | Permission | Purpose |
|---|---|---|
| `/distribution` | `distribution:VIEW` (run needs `ASSIGN`) | Overview, **preview → apply**, unworked-lead alerts, recent runs |
| `/distribution/rules` (+ new / edit) | view `VIEW`, change `MANAGE` (admins) | The rules interface |
| `/distribution/agents` | view `VIEW`, change `EDIT` (managers, admins) | Per-agent limits, service areas, pause switch |
| `/distribution/approvals` | view `VIEW`, decide `APPROVE` | Approval-based reassignment |

## Methods
- **Round robin:** turns through eligible agents in a fixed order (position saved per rule), skipping anyone at a limit.
- **Equal distribution:** fewest leads received *today* (including this run) wins.
- **Workload based:** fewest *open* leads right now wins (open = not Converted, Lost, Invalid or DND).
- **Campaign based:** only agents allowed for the campaign (rule's agent list and/or team); lightest workload wins.
- **Location based:** prefers agents whose service cities/states cover the lead's city/state (case-insensitive); lightest workload wins. If nobody covers it, the lead stays unassigned unless the rule allows "fall back to any eligible agent".
- **Manual:** bulk assignment on `/leads` (see below).

## Rules
A rule says *which leads* (campaign, source, minimum priority, cities, states), *who may receive them* (team and/or chosen agents), and *limits* (max open leads, max per day). The **first active rule by order number that matches a lead decides** how it is shared. Within a run, urgent leads go first, then oldest first.

## Who is never given leads
Inactive or archived users, anyone whose **Pause new assignments** switch is on, anyone marked Absent / On leave / Holiday in today's attendance, agents at their own or the rule's limit (the stricter applies), and anyone outside the rule's pool or the operator's own scope.

## Reassignment and approval
- Unassigned leads can be assigned directly by anyone with `lead:ASSIGN`.
- **Leads that already have an owner** are moved directly only by people with `distribution:APPROVE` (managers, admins). Everyone else (e.g. team leaders) files a **request with a reason**; a manager approves or rejects it.
- If the lead's owner changed after the request, or the new owner is no longer available, approval is refused and the request is closed automatically.
- Every move records actor, time, reason, previous and new owner (and the rule/run for automatic ones) in `LeadAssignment`; it never overwrites earlier rows. Requests and decisions are kept in `ReassignmentRequest` and the audit log.
- **Absent employees:** *Preview → Unworked leads of absent employees* re-plans assigned-but-never-called leads away from agents marked absent today (needs approval rights).

## Unworked-lead alerts
A lead is "unworked" when it has an owner, is still in the Assigned status, has no call logged and no assignment event within the last *N* hours (default 4, adjustable by admins). The overview lists counts per agent, and `/leads?work=unworked` lists the leads.

## Race-condition and duplicate protection
1. **Run lock:** applying takes a PostgreSQL advisory lock, so runs apply one at a time, and the plan is recomputed *after* the lock so limits are never stale.
2. **Idempotent runs:** the Apply form carries a run ID that is a primary key. Double-clicks, retries or two tabs return the first result.
3. **Compare-and-swap per lead:** each lead is moved with `WHERE ownerId IS NULL` (or `= previous owner`); a lead someone else just assigned is skipped and reported, never overwritten.
4. **Unique idempotency key** (`runId:leadId`) on assignment rows; open reassignment requests are unique per lead.
5. Lead codes come from an atomic counter, so simultaneous imports cannot collide.

Tests: the pure engine is covered by `tests/distribution-engine.test.ts` (run with `npm test`). Concurrency tests (simultaneous runs, double-submit, simultaneous imports, double-run import) are in `tests/integration/` and need a throwaway PostgreSQL database: `TEST_DATABASE_URL=… npm run test:integration`. **They have not been run yet.**

## Known gaps
1. **No automatic trigger.** Distribution runs when someone clicks Apply. Auto-distributing on import, on a schedule, or when a lead arrives needs the background-job setup (Redis/BullMQ).
2. **No notifications.** Unworked alerts appear on the overview page only; pushing them to team leaders needs the notification phase (Phase 09).
3. **Absence comes from attendance records**, which are built in Phase 10. Until then nobody counts as absent; use *Pause new assignments* for planned absences.
4. **Manual bulk assignment is not under the run lock.** It is safe per lead (compare-and-swap) but can briefly overshoot an agent's cap if it overlaps a run.
5. **Only telecallers receive automatic assignments** (team leaders can receive manual ones).
6. A run handles at most 2,000 leads; run again for the rest.
7. Daily limits count every assignment received today (any method, including manual and approved reassignments).
8. Weighted distribution (e.g. senior agents get more) and shift-hours awareness are not implemented.

## Related fix in this phase
Managers could not see brand-new leads (no owner, no team), so they could never distribute them. The Manager data scope now includes unowned, team-less leads. See `docs/AUTH.md`.
