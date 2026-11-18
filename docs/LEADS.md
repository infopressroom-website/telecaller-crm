# Lead management (Phase 05)

## Pages
| Path | Who | What |
|---|---|---|
| `/leads` | Anyone with `lead:VIEW` (telecallers see only their own leads) | Search, filters, sort, saved views, bulk assign / status, export |
| `/leads/new` | `lead:CREATE` | Add a lead (warns if the mobile already exists) |
| `/leads/[id]` | `lead:VIEW` + in scope | Details, status, notes, timeline, same-number duplicates, merge |
| `/leads/import` and `/leads/import/[id]` | `lead:CREATE` | Upload → map columns → check → import → report |

## Rules enforced on the server
- **Scope:** every list, detail, bulk action, export and import update goes through the Phase 03 data scope. An out-of-scope lead ID returns "not found".
- **Telecallers** can edit contact details, priority, status and add notes on their own leads. Name, mobile, source, campaign and notes fields need `lead:CREATE`.
- **Lead IDs** (`LD-000001…`) come from an atomic counter, so imports and manual creates never collide.
- **History is never overwritten.** Edits, status changes, notes, imports and merges add rows to `LeadActivity`; assignments add `LeadAssignment` rows. The timeline combines these with calls and follow-ups.
- **Bulk limits:** up to 200 leads per action, current page only. Assigning requires `lead:ASSIGN` and a target who is an active Telecaller/Team Leader inside your scope.
- **Export:** `lead:EXPORT`, same filters as the list, max 50,000 rows, every export is audited, and text starting with `= + - @` is escaped to prevent spreadsheet formula injection.

## Import pipeline
1. **Upload** (`.csv`/`.xlsx`, ≤ 5 MB, ≤ 20,000 rows). File type is checked by content as well as extension. Excel formulas are read as their computed value, never evaluated.
2. **Map columns** (auto-guessed, editable) with a preview of the first 5 rows.
3. **Check:** each row is validated (mobile normalised to `91XXXXXXXXXX`, email, priority, source name). Rows are marked *valid*, *duplicate* (mobile exists, or repeats an earlier row) or *invalid*.
4. **Decide duplicates** for the whole file: skip, update the existing lead (changes are logged), or keep as a separate lead.
5. **Import** in chunks of 500 with a progress bar. A chunk is saved atomically; if one fails, its rows are marked *failed*, earlier chunks are kept.
6. **Report:** every row that was not created or updated (invalid, duplicate-skipped, failed) downloads as a CSV with the original columns and the reason. Nothing is silently dropped.

Duplicate rows are matched against *all* leads; "update" only applies if the existing lead is inside your access, otherwise the row is skipped with a reason.

## Merge
`lead:MANAGE` (admins, managers). Calls, follow-ups, tasks, assignments and notes move to the kept lead; blank contact fields are filled from the merged one; the merged lead is archived with a pointer to the kept lead, and a "merged" entry (with counts and call IDs) is added to the timeline and audit log. Nothing is deleted.

## Known gaps (not done in this phase)
1. **Configurable statuses.** Statuses are a fixed list (the 11 in the blueprint). Renaming/adding statuses needs a settings screen (later phase).
2. **Configurable optional fields.** The `customFields` column exists but there is no UI or import mapping for custom fields yet.
3. **Import runs inside the request.** Fine for the 20,000-row cap; larger files or multi-user peaks need the BullMQ/Redis worker.
4. **Bulk actions apply to the selected rows on the current page only** (no "select all matching filter").
5. **Search uses `ILIKE`.** Fine for tens of thousands of leads; for hundreds of thousands add a `pg_trgm` index on `name` and the mobile columns.
6. **Merge cannot be undone from the UI** (the audit entry keeps the moved call IDs for manual recovery).
7. **No integration tests yet** for the import pipeline, bulk assignment or merge against a real database. Unit tests cover parsing, mapping, validation, filters and permissions.
8. Lead edit form lacks optimistic concurrency (last save wins; every change is logged in the timeline).
