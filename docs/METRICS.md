# Dashboard metrics (Phase 04)

All dates are India Standard Time. Ranges are half-open (`from` inclusive, `to` exclusive). Every query is first limited to the viewer's data scope (see `docs/AUTH.md`), then narrowed by the optional Team/Campaign filters; filters can never widen access.

**Basis:** *In period* = respects the date filter. *Snapshot* = current state, ignores the date filter. Cards are tagged accordingly.

| Metric | Basis | Definition |
|---|---|---|
| Total leads | Snapshot | Non-archived leads in scope |
| New leads today | Snapshot | Created today (IST) |
| Assigned leads | Snapshot | Leads with an owner |
| Call attempts | In period | Call records created in the period |
| Connected calls | In period | Attempts whose outcome has `isConnected = true` |
| Interested leads | Snapshot | Current status = Interested |
| Follow-ups due | Snapshot | Pending, due today or overdue |
| Converted leads | In period | Distinct leads with a "Converted" call, or a status change to Converted, in the period |
| Active telecallers | Snapshot | Active users with the Telecaller role (not attendance) |
| Pending tasks | Snapshot | Open or In progress |

## Charts
- **Daily activity:** attempts and connected per IST day; ranges over 62 days are summed into 7-day buckets.
- **Funnel:** leads *created in the period*, then how many were ever contacted / connected / interested / converted. It is a cohort view, not a daily flow.
- **Source / campaign:** leads created in the period and how many of them were converted (any time since).
- **Telecaller comparison:** top 10, ranked by conversions, then connected calls, then attempts. Call volume alone never decides the ranking.
- **Team productivity:** the same figures grouped by the telecaller's team.
- **Follow-up completion:** follow-ups *due in the period*. Rate = completed ÷ (completed + missed + overdue pending).

## Known limitations
1. ~~Conversions came only from call outcomes.~~ Fixed in Phase 05: status changes are now recorded and counted. Status changes made before Phase 05 were not recorded and are not counted.
2. Active telecallers and pending tasks ignore the campaign filter (the card says so).
3. "Employee activity" feed and live presence are not on this dashboard; they depend on attendance (Phase 10).
4. No export or scheduled reports yet (Phase 11).
5. Performance is untested at volume. Added indexes on `CallLog(createdAt)`, `CallLog(dispositionId, createdAt)`, `LeadAssignment(createdAt)`. Load-test with realistic data before go-live (Phase 12).

## Demo data
`npm run db:seed` then `npm run db:seed:demo` creates ~300 fabricated leads (codes `DEV-…`, notes say "demo data"), calls, follow-ups, two teams and four extra telecallers so the dashboard has content. Development only; refuses to run in production.
