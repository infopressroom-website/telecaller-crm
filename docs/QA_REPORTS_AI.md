# QA, reports, audit and AI (Phase 11)

## Quality assurance (`/qa`)
- **To review** lists finished calls with no review (recordings first); **Reviewed** is the history. Reviewers rate 7 weighted criteria 1–5 (weights add up to 100; score = weighted %). Add feedback and private coaching notes.
- One review per call; reviewers can't review their own calls; scope applies (a team leader only sees their team's calls).
- Telecallers see feedback on their own reviewed calls on **My performance**. Review scores feed the performance page and the QA report.
- The scorecard is defined in `lib/qa/scorecard.ts`.

## Reports (`/reports`)
Calling activity (day/week/month), telecaller performance, team comparison, lead source, campaign conversion, conversion funnel, follow-up completion, attendance (monthly), productivity (calls per hour worked), QA scores. Filters: period, team, campaign. Each respects the viewer's data scope; attendance/productivity/QA reports also need the matching permission. **Export** to CSV (formula-injection safe), Excel and PDF; every export is audited. Definitions follow `METRICS.md`.

## Audit log (`/audit`, administrators)
Append-only list of who did what, when and from where: sign-ins and lockouts, password changes, employee changes, assignments, imports/exports, recording access, settings, automation and incentive decisions. Filter by action prefix, person and date. Secrets are never written to it.

## AI assistant (optional, off by default)
- Not required for anything else. Enable in **Settings → AI** after setting `ANTHROPIC_API_KEY` and `AI_MODEL` on the server and ticking the acknowledgement.
- **What it does:** QA reviewers paste/type a call transcript; "Analyse" asks the model for a summary, customer intent, objections, coaching ideas and a communication note, with a *model-reported* confidence (indicative only).
- **Guardrails:** results are labelled AI-generated, need a human to accept or reject, are never turned into scores, tasks or HR actions automatically, and the prompt forbids guessing, personal remarks and disciplinary recommendations and tells the model to ignore instructions inside the transcript.
- **Privacy:** transcript text (may contain customer names/numbers) is sent to the AI provider. Confirm that your privacy policy and customer consent allow it before enabling.
- **Not included:** automatic transcription of recordings (speech-to-text), sentiment or voice analysis, call scoring by AI. The code that calls the API is untested without a key.

## Known gaps
1. No scheduled/emailed reports (the end-of-day automation sends an in-app summary only).
2. PDF export is a plain table (Latin-1 characters only; other scripts show as "?"), untested against real data.
3. Monthly grouping of calling activity for ranges over 62 days uses the already weekly-bucketed data.
4. QA scorecard is fixed in code (edit the file to change it); no per-campaign scorecards or calibration/dispute workflow.
5. No automatic speech-to-text; AI is optional and untested.
