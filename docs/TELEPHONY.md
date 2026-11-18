# Call management & telephony (Phase 08)

> **Honest status:** nothing in this phase has been run against a real Exotel account. The Exotel adapter was written from Exotel's *public documentation* and has **never placed a real call**. Real calling is therefore **off by default** and can only be switched on after an administrator places a real test call from Settings → Telephony and confirms it worked. Until then agents dial from their own phones (the Phase 07 behaviour).

## What exists
| Area | Where |
|---|---|
| Call history with filters (agent, team, lead, date, outcome, direction, status) | `/calls`, `/calls/[id]` |
| Configurable call outcomes (name, order, "connected", "final", "needs follow-up", status it sets) | `/settings/dispositions` |
| Provider settings, test call, agent phone numbers, webhook health, recovery tools | `/settings/telephony` |
| Provider-neutral contract | `lib/telephony/provider.ts` |
| Exotel adapter (isolated) | `lib/telephony/exotel.ts`, `exotel-parse.ts` |
| Sandbox provider (development only, contacts nobody) | `lib/telephony/sandbox.ts` |
| Webhook endpoint | `POST /api/webhooks/telephony/exotel/<secret>` |
| Recording access (permission-checked, audited) | `GET /api/calls/[id]/recording` |

To add another vendor: implement `TelephonyProvider` + a webhook parser, register it in `lib/telephony/registry.ts`. Nothing outside `lib/telephony/` mentions Exotel's field names.

## Modes
- **Manual** (default): no provider. "Start call" opens the phone dialler; duration is the on-screen timer.
- **Live**: only when provider = Exotel, server credentials exist, a business number is set, `EXOTEL_WEBHOOK_SECRET` is 24+ characters **and an admin has confirmed a successful test call**. The provider rings the *agent* first, then the customer.
- **Sandbox**: development only (disabled when `NODE_ENV=production`). No call is placed. Every sandbox screen and call is labelled SANDBOX. Admins can push synthetic webhook statuses onto sandbox calls to exercise the pipeline.

## Click-to-call flow (live)
1. Agent presses **Start call** → the CRM creates the call record *first* (keyed by a browser-generated reference), then asks Exotel to connect the agent's phone to the customer. Pressing twice returns the same call; the customer is never dialled twice.
2. Our call ID goes to Exotel as `CustomField`; Exotel echoes it on every webhook, so even a webhook that beats the dial response is matched.
3. If Exotel is unreachable, the outcome is ambiguous, so the call stays open with a message to check the phone before retrying. If Exotel rejects the request, the call is marked failed.
4. The webhook (`terminal` event) sets the provider status, end time, talk time and recording link. The agent separately records the outcome and notes; those are never overwritten by the webhook, and the provider's final status is never overwritten by the agent.

## Webhook safety
1. **Secret in the URL**, compared in constant time; wrong secret = 404.
2. Optional **IP allow-list** (IPv4/CIDR). We do not hard-code Exotel's addresses; paste the current list from Exotel.
3. Optional **HMAC-SHA256 signature check** (header name and encoding configurable, keyed with the API token). **Off by default**, because Exotel's documentation is inconsistent about the exact scheme. Turn it on only after Exotel confirms it.
4. Strict parsing: safe call ID characters only, `https` recording links only, size limit 100 KB, numbers clamped.
5. **Store first, process second.** Each event is saved with a unique dedupe key (call ID + status + event type + timestamp). Provider retries and replays are acknowledged and ignored. If storing fails we return 5xx so the provider retries; if processing fails the event is kept as FAILED and can be re-processed from Settings.
6. **Out-of-order protection:** a finished call never reopens; the first provider-reported final status wins; later events only fill blanks (e.g. the recording link).
7. **Missed webhooks:** "Check unfinished calls with the provider" asks Exotel's Call Details API about calls that should have finished. (A scheduled job for this arrives with the background-job setup.)
8. Inbound calls are matched to a lead by the caller's number and attributed to the lead's owner; unmatched callers are listed in Webhook health, never lost.

## Secrets
API SID, key and token and the webhook secret live **only in server environment variables** (`.env`). They are never stored in the database, rendered, logged, or sent to the browser; they are used only in an `Authorization` header from server code. The settings page shows set/missing only. **Caveat:** the webhook secret is part of the URL path, so it appears in your hosting provider's access logs; rotate it if logs are shared, and prefer the IP allow-list/signature once confirmed.

## Recordings
Only the link and metadata are stored (no audio copy). Playback needs `qa:VIEW` or `call:MANAGE` (QA managers, managers, admins), is checked against the viewer's data scope, and each access is audit-logged. The link itself is the provider's; if it is public or non-expiring, anyone who has it can listen, so ask Exotel about expiring/authenticated links or plan to copy recordings into private storage.

## Not verified / assumptions (please confirm with the client and Exotel)
1. **Request format** of Connect Two Numbers (`From`, `To`, `CallerId`, `Record`, `StatusCallback`, `StatusCallbackEvents[0]=terminal`, `StatusCallbackContentType=application/json`, `CustomField`), Basic-auth header, regional hosts `api.in.exotel.com` / `api.exotel.com`. From docs; **untested**. The response's call ID location (`Call.Sid`) is parsed defensively; if it can't be found the call is *not* treated as placed.
2. **Webhook field names** (`CallSid`, `Status`, `Duration`, `ConversationDuration`, `RecordingUrl`, `CustomField`, `Direction`, `DateUpdated`, `StartTime`, `EndTime`) from docs. Inbound field names (`From`/`CallFrom`) are partly guessed.
3. **Timestamp timezone.** Exotel's docs don't state it; we assume India time (UTC+5:30), configurable.
4. **Signature scheme / header name / IP ranges**: unconfirmed (see above).
5. **Talk time:** we store `ConversationDuration` when present, else total `Duration`.
6. **Inbound routing:** which agent answers an inbound call is decided by your Exotel call flow. We attribute to the lead's owner; real answered-by attribution needs a design decision.
7. **Credential check** uses a read-only list-calls request; it proves the credentials work, not that calls can be placed (hence the mandatory test call).

## Questions for the client (cannot be answered by us)
- **Provider and pricing:** is Exotel confirmed? Per-minute rates (agent leg + customer leg), recording storage, concurrent-call limits, setup fees.
- **Numbers:** which ExoPhone/virtual number(s), who provisions them, and what KYC/onboarding Exotel requires.
- **Telecom/legal:** TRAI rules for commercial calls (DND/NDNC scrubbing, calling windows, header/number series), **consent and disclosure for call recording**, retention period for recordings, data-residency needs. Get this from the client's legal/compliance adviser; we have not assessed it.
- **Agent phones:** are agents on mobiles (provider rings them) or a browser/desk softphone? A softphone changes the integration.
- **Inbound:** should inbound calls route to the lead owner, a queue or an IVR?
- **Costs when sandbox/test calls are used** and who pays for them.

## Go-live checklist
1. Set `EXOTEL_*` and a 24+ character `EXOTEL_WEBHOOK_SECRET` in the server environment; `APP_URL` must be public `https`.
2. Settings → Telephony: choose Exotel, region, business number, recording choice; save.
3. In Exotel, set the callback URL shown on the page (with your secret) and confirm IP list / signature options.
4. Run steps 1–3 (credentials → real test call → confirm).
5. Add each agent's mobile number.
6. Make one real call as an agent; check the call appears in `/calls` with talk time and recording.
7. Review the unknown items above and set the optional IP/signature checks.

## Tests
Unit (`npm test`): payload parsing, status/ordering rules, timestamps, HMAC/IP/secret helpers, settings validation, call filters, configurable outcomes. Integration (`npm run test:integration`, throwaway database, sandbox provider, synthetic events): double-click safety, webhook-before-response, simultaneous identical webhooks, out-of-order events, provider-vs-agent precedence, inbound matching, retry of failed events. **Integration tests have not been run.**

## Known gaps
1. Never tested against real Exotel (see above). 2. No scheduled reconciliation or automatic retry of failed events (manual buttons only). 3. No call cost capture. 4. Recordings are links only; no copy to private storage, no transcription (Phase 11). 5. No call export. 6. No softphone/browser calling. 7. Inbound agent attribution is by lead owner only. 8. Sandbox calls appear in call history (labelled) and would count in reports, which is why sandbox is blocked in production.
