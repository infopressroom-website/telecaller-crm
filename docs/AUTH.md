# Authentication & RBAC (Phase 03)

## How it works
- **Sessions:** random 32-byte token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Only its SHA-256 hash is stored (`Session` table). Absolute expiry 12h, idle expiry 2h (`lib/auth/constants.ts`).
- **Every request is re-validated against the database** (`getCurrentUser`): session not revoked/expired, user still ACTIVE. Deactivating a user or changing a role's grants takes effect immediately.
- **Middleware** only checks that a cookie exists (cheap redirect to `/login`). It is not a security boundary.
- **Enforcement points:** layouts and pages (`requireUser`, `requirePagePermission`), API handlers (`requireApiPermission`), and services (`assertCan`, `getAccessibleLead`). Hiding nav items is cosmetic only.
- **Server actions** (`app/actions/auth.ts`) get Next.js's built-in origin check; cookies are `SameSite=Lax`.

## Login protection
- Generic error for unknown email / wrong password / inactive account; a dummy bcrypt compare equalises timing for unknown emails.
- 5 failed attempts lock the account for 15 minutes. Every attempt is written to `LoginHistory`; lockouts, logouts, password changes and reset requests/completions are written to `AuditLog`.
- Password policy: 10–128 chars with upper, lower and a number. bcrypt cost 12.
- Changing a password signs out all other devices; resetting signs out all devices.
- Reset links: single-use, 1 hour, only the hash is stored.

## Roles, permissions, scope
- 8 roles × 16 resources × 8 actions, defined in `lib/permissions.ts` and seeded. **What** a user can do = permissions. **Which records** = scope (`lib/auth/scope.ts`):

| Role | Lead scope |
|---|---|
| Super Admin, Admin | All (non-archived) |
| Manager | Teams they lead, teams led by their direct reports, their own team, **plus unassigned team-less leads** (so they can distribute new leads, added in Phase 06) |
| Team Leader | Teams they lead, their own team, leads they own |
| Telecaller | Only leads they own |
| QA, HR, Viewer | No lead-level access |

- `getAccessibleLead` returns NOT_FOUND (not FORBIDDEN) for out-of-scope IDs, so changing an ID in a URL reveals nothing.

## Needs client confirmation
1. **Manager "departments":** there is no Department model, so Manager scope is team-based as above.
2. **Email delivery** is not configured. In development the reset link prints to the server console; in production nothing is sent until a provider is wired in.
3. **Per-IP rate limiting** needs Redis; only per-account lockout exists so far (planned for Phase 12).
4. No admin UI yet to create users, change roles or unlock accounts (Phase 10 employee management). Use the seed accounts until then.

## Tests
`npm test` runs pure unit tests: permission matrix (allowed and denied cases per role), scope filters, password policy. **Not yet covered:** integration tests against a real database (login lockout, session expiry, reset flow, cross-user lead access). Do these before closing the phase.

## Dev accounts
After `npm run db:seed`: `<role>@crm.test` (e.g. `telecaller@crm.test`, `admin@crm.test`) with `SEED_DEV_PASSWORD`. Re-run the seed after pulling this phase so updated grants apply.
