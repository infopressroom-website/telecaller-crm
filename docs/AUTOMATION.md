# Follow-ups, automation and notifications (Phase 09)

## Follow-ups (`/follow-ups`)
- Views: **Due today**, **Upcoming**, **Overdue** (pending from an earlier day; due-today items show a "Late" badge once their time passes), **Completed**, **Missed**. Telecallers see their own; managers and team leaders can switch to the team's.
- Actions: **Mark done** and **Reschedule** (the old follow-up is kept as "Rescheduled" and a new one is created, so history is never rewritten). Both are compare-and-swap, so two people can't handle the same follow-up. Every change updates the lead's "next follow-up" and adds a timeline entry.
- New follow-ups come from the call flow (Phase 07) or the "Schedule a follow-up" box on a lead.
- A follow-up still pending 24 hours after it was due becomes **Missed** (done by the scheduler).

## Automation (`/automation`, administrators)
A rule is **Trigger → Conditions → Actions**.

| Trigger | Fires when | Allowed actions |
|---|---|---|
| Follow-up due | a pending follow-up's time arrives (within the last 24 h) | notify owner / manager / role |
| Follow-up overdue | still pending N minutes after due (default 60) | notify owner / manager / role |
| Lead not contacted | assigned, no call, nothing happened for N hours (default 4) | notify owner / manager / role, create review task |
| Lead converted | a conversion in the last 24 h | notify owner / manager / role |
| New leads waiting | at least N unassigned new leads | distribute leads, notify role |
| Employee absent | today's attendance is Absent or On leave | notify manager / role, create review task |
| End of working day | after hour H (India time) | daily summary |

Conditions: campaign and minimum lead priority. Actions: up to 3 per rule.
- **Test (dry run)** shows what a rule would act on right now without sending or assigning anything. New rules start OFF.
- Starter rules (all OFF) are created by the seed.
- **Manager lookup:** "reports to", else the team leader. If neither exists the alert goes to the rule's creator, prefixed "[No manager set]", so alerts are not silently lost.
- Notifications to a whole role omit the customer's name.
- "Distribute leads" runs as the rule's creator and needs that person to still be active with permission to distribute.

## Reliability
- Each (rule, event) is claimed once in `AutomationLog` (unique key); a failed attempt is retried up to 3 times; notifications also have a unique key, so repeated runs and two schedulers at once cannot double-send.
- Rule JSON read back from the database is validated defensively.

## Scheduler
There is no always-on worker. Call the endpoint every minute from any scheduler:
```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/automation
```
(system cron, your host's cron feature, or an uptime pinger). `CRON_SECRET` must be 24+ characters or the endpoint is disabled. The Automation page shows the last run and warns when it has not run for 10 minutes. Admins can also press "Run all rules now".

## Notifications (`/notifications`, bell in the top bar)
In-app only, with unread count and mark-read. **Email, SMS and WhatsApp are not implemented**: no provider is connected, nothing is sent to customers, and there is therefore no customer opt-out handling yet. If customer messaging is added later it must check consent/opt-out before every send and log delivery status.

## Known gaps
1. Needs a scheduler (above); without it only "Run now" works. Moving to a queue (Redis/BullMQ) would add retries, backoff and scale.
2. In-app notifications only; polling-free (no live push): the count updates on page load.
3. Rules support the listed triggers/conditions only (no free-form expressions, no custom message text, no per-rule schedules).
4. The "unworked lead" definition needs an assignment event; leads assigned before Phase 06 may behave oddly.
5. Not run against a real database yet; unit tests cover rule validation and messages only.
