# Telecaller workspace (Phase 07)

## Screens
| Path | What it is |
|---|---|
| `/workspace` | Home: call-target progress, 8 number tiles, follow-ups due, "Up next" queue, **Start next lead** |
| `/workspace/next` | Read-only: picks the next eligible lead and redirects (or back home when nothing is ready) |
| `/workspace/lead/[id]` | Single-screen lead workspace: customer details + previous call notes on the left, call workflow on the right |

## Home numbers
| Tile | Meaning |
|---|---|
| My assigned leads | Open leads you own (not Converted / Lost / Invalid / DND) |
| New leads | Status New or Assigned (never called) |
| Today's follow-ups | Pending follow-ups due today (overdue from earlier days shown in the hint) |
| Pending leads | New, Assigned or Attempted (not yet reached) |
| Interested / Converted | Your leads with that status (converted also shows "today") |
| Calls completed | Today's finished calls (not in-progress ones) |
| Today's call target | Your personal daily CALL_ATTEMPTS target; "No target set" if none. Team targets are not per-agent, so they are ignored. |
| Ready to call now | Leads the queue would offer right now |

## Who gets called next
1. **Due follow-ups** (oldest first). A promise to the customer comes first.
2. **New leads** (urgent/high priority first, then oldest).
3. **Retries** (priority, then longest since last contact).

Never offered: finished leads, leads whose follow-up is still in the future, retry leads contacted in the last 30 minutes, and leads you skipped this session ("Skip this lead" keeps a skip list in the URL).

## Call flow
Start call → Outcome → Notes → Follow-up (if needed) → Save activity → Next eligible lead.
- **Start call** records the start on the server and opens `tel:` on the device. *No call is simulated and no network call data is read*: duration is the on-screen timer from Start to Save. Real call logs, recordings and click-to-dial arrive with telephony (Phase 08). "I already made this call — log it" saves without a duration.
- **Outcome buttons** come from the call-disposition list; keys **1–9, 0** choose them, **N** focuses notes, **F** toggles the follow-up, **Ctrl/⌘+Enter** saves.
- **Callback requested** forces a follow-up time. Times are entered in India time.
- **Saving** does everything in one database transaction: the call record, the lead's new status, any follow-up (and marks due follow-ups on this lead done) and a timeline entry. Status rules (`lib/workspace/status.ts`): decisive outcomes (converted, not interested, wrong number, DND) always apply; softer ones only move a lead forward, so "no answer" never downgrades an interested lead; a converted lead is never changed by a call.
- **Do Not Disturb leads cannot be called or logged.**

## Safe drafts and saving
- What you type (outcome, notes, follow-up) is kept in this browser (`localStorage`) until saved, restored after a refresh, and the browser warns before you close an unsaved screen. If storage is blocked, drafts just don't persist.
- Every call has a unique reference created in the browser. **Saving twice (double-click, retry after a network error) never creates a second call or follow-up**; the second attempt reports "already saved".
- A started call that wasn't finished is resumed after a refresh with its timer.
- Clear success and error messages are shown inline; on any error your notes stay on the screen.

## Access
A telecaller can only open, start or save calls on leads they own: anything else looks like it doesn't exist (404). Other agents' leads never appear in any list. Permissions are checked in the service layer, not just the UI.

## Known gaps
1. **Telephony is Phase 08.** No click-to-call through a provider, no real call duration, no recordings. Draft storage is per browser, not shared across devices.
2. **No screen to set targets** until Phase 10; demo targets come from `npm run db:seed:demo`.
3. **No dedicated follow-up pages** (list, reschedule, complete, overdue alerts) until Phase 09; follow-ups can be created here and appear on the home screen and in lead timelines.
4. **Follow-up times are India time only.**
5. Queue considers an agent's first 500 open leads; the 30-minute retry cool-down is fixed.
6. Keyboard shortcuts are not customisable; the outcome list is limited to 10 shortcut keys.
7. Not yet tested in a browser: the call panel is exercised only by unit tests of its logic. Service-level behaviour is covered by `tests/integration/workspace.int.test.ts`, which **has not been run**.
