# Security overview

Verification status: **designed and reviewed, not penetration-tested, not run.** Use this as a basis for a real security review.

## Implemented
- **Authentication:** database-backed sessions (random 32-byte token in an httpOnly, SameSite=Lax, Secure-in-production cookie; only a SHA-256 hash stored), 12 h absolute / 2 h idle expiry, re-validated against the database on every request (deactivation and role changes apply immediately).
- **Passwords:** bcrypt cost 12; policy 10–128 chars with upper, lower and digit; unknown/inactive/wrong-password responses are identical with timing equalisation; 5 failed attempts lock an account for 15 min; password change/reset signs out other devices; reset links are single-use, 1 hour, hash-only. Temporary passwords force a change at first sign-in.
- **Authorisation:** 8 roles × 16 resources × 8 actions enforced in the service layer (not only the UI) plus **data scoping** (own / team / all). Out-of-scope IDs return "not found". Role assignment is hierarchical. Hiding menu items is cosmetic only.
- **Input handling:** Zod validation on every action/route; Prisma parameterised queries (the few raw SQL queries use bound parameters); file uploads limited to .csv/.xlsx with size/row limits, content-sniffed, Excel formulas read as values; CSV/Excel exports neutralise formula injection; recording and webhook URLs must be https.
- **Concurrency/abuse:** compare-and-swap updates, advisory lock for distribution, idempotency keys for calls, assignments, imports, notifications, automation and webhooks.
- **Secrets:** only in the server environment; never logged (logger redacts password/token/secret/key/cookie/authorization), never rendered or sent to the browser.
- **Webhooks:** secret path (constant-time), optional IP allow-list and HMAC signature, size limits, store-then-process, dedupe.
- **Headers:** CSP (see caveat), HSTS (production), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy. Server actions have Next.js's origin check; cookies are SameSite=Lax.
- **Rate limiting:** sign-in (per IP and per email) and password-reset requests.
- **Audit:** append-only audit log for sensitive actions; recording access is logged.

## Caveats and risks you must decide on
1. **Rate limiting is in-process.** Each app instance counts separately. Put a WAF/CDN or Redis-backed limiter in front for real protection.
2. **CSP allows `'unsafe-inline'` scripts** because Next.js hydration needs them. A nonce-based CSP would be stricter.
3. **Webhook secret in the URL** appears in access logs; rotate if logs are shared. Prefer IP allow-list/signature once confirmed with Exotel.
4. **Recording links are the provider's.** If public/non-expiring, anyone with the link can listen.
5. **Duplicate detection** during imports can reveal to a manager that a number exists elsewhere (they cannot open or edit it).
6. **No MFA, no SSO, no password-breach checks, no session list/"sign out everywhere" button** for users.
7. **PII:** leads, calls, recordings and transcripts are personal data. Retention, deletion/erasure requests, consent for recording and calling (DND rules) and any cross-border transfer (including AI) are the client's legal responsibility; none is implemented beyond access control and audit.
8. Dependencies are pinned but unaudited; run `npm audit` and keep them updated.
9. No automated dependency/vulnerability scanning or secret scanning is configured beyond what your Git host offers.

## Recommended before go-live
Independent security review/pen test; enable HTTPS-only; WAF; Redis/edge rate limits; MFA for admins (needs an identity provider or an added feature); restrict database network access; encrypted backups; log shipping with alerts; a written incident-response and data-retention policy.
