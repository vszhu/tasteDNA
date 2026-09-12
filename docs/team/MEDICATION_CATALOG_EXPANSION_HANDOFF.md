# Medication catalog and private friend-circle integration

Read [LLM_HANDOFF.md](LLM_HANDOFF.md) and [MEDICATION_CHECKS.md](../MEDICATION_CHECKS.md) first. This change started from main `8bdb4c4`, incorporated `ccb1fc1` (PRs #29 and #30), and merged in [PR #31](https://github.com/vszhu/tasteDNA/pull/31) as `344424d`. The user requested more medicines, testing with their two authorized accounts, and group recommendations based on each person's account list. That explicitly extends the earlier tab-only feature scope.

## Behavior

- Catalog `2026-09-12.2` expands four forms to twelve: atorvastatin, levothyroxine, ciprofloxacin, metronidazole, spironolactone, buspirone, alendronate, and phenelzine are added to the existing four. The medication guide links the authoritative sources checked on September 12, 2026. Form selection, timing, quantities, uncertain ingredients, and unsupported medicines remain explicit.
- `/medications/settings` is the direct entry from the circle and session screens. The same editor remains available inside the medication map. Search accepts brands such as Synthroid, then the user chooses the exact form.
- Anonymous lists and unsaved changes remain in account-scoped tab storage. Saving to an account is explicit. A saved list restores on reload/sign-in; an unsaved draft survives only if the account's revision has not changed. Anonymous drafts are never adopted or uploaded automatically. Account-switch generations mask stale network responses, and group room/result components reset on account changes.
- `user_medication_profiles` is a separate owner-only table. Its `use_in_groups` flag defaults false. Friends cannot read or write it. Clearing the tab list does not change a saved group list until Save; deleting the account copy turns off group use while keeping the tab draft. An opted-in empty list means the owner explicitly saved no medications to check.
- For each accepted member, the group server reads consent/revision metadata first, then loads names only for opted-in accounts. It checks each person's dishes and passes only excluded item IDs into the existing fairness engine. The creator's list is never applied to everybody.
- Review/avoid dishes cannot become assignments for that member. A venue without an eligible option for anyone is withheld when medication checking is active. If none remain, the server returns a review-needed error, not a fabricated recommendation. Taste base scores and learning stay unchanged.
- Shared results include generic private-review reasons and aggregate coverage counts. They never contain medication names, raw account lists, doses, rule IDs, or private account revisions. The fingerprint hashes only random revision IDs. Do not add medication names to shared menu rows, taste records, model prompts, or group request bodies.
- A selected food reference is not medical clearance. Timing/portion findings are held for review without inventing a dosing schedule. Unknown medicines or missing ingredients cannot silently become cleared choices. Members who did not opt in are reported as unchecked.

## Database and freshness

Apply `supabase/migrations/202609120005_medication_profiles.sql` after all existing migrations and **before the app deployment**. Do not silently disable checks if the private table cannot be read.

The migration adds the private table and RLS, bounded-list validation, server-generated random revisions, result invalidation triggers, and a service-only `persist_medication_group_recommendation` wrapper. Profile writes/deletes expire affected group results. Membership changes also expire results. The wrapper holds a session lock and ordered account advisory locks, verifies the exact accepted-member revision set, then calls the existing atomic persistence RPC. Concurrent changes return SQLSTATE `40001`, which the API turns into a recompute message.

GET checks current revision fingerprints and catalog version, including legacy snapshots with no medication summary. An expired result is withheld and the UI asks for a fresh computation. Group pages already refresh every 15 seconds while visible and on focus. The owner's settings reload on page reload/sign-in; there is no realtime cross-device account-list subscription.

The old service-only persistence function remains for compatibility inside the new wrapper. No new browser permission is granted for either persistence RPC.

## Verification

Application suite, ESLint, and production build passed. The exact latest count is recorded in the central handoff. New regressions cover form/brand search, source distinctions, cooked/alcohol-free phrase overlap, account load/save/delete, explicit consent, unsaved drafts, failed writes, account-switch races, unchanged taste scores, per-member exclusions, withheld venues, incomplete coverage, and stale result detection.

The isolated database harness applies **every repository migration unchanged**, with only Supabase's built-in auth schema/roles supplied by the harness. It uses [PGlite and its pgvector extension](https://pglite.dev/extensions/) and needs no live database or credentials:

```sh
npm install --prefix /tmp/tastedna-medication-db-check --no-package-lock --no-audit --no-fund @electric-sql/pglite@0.5.8 @electric-sql/pglite-pgvector@0.0.9
node scripts/check-medication-db.mjs /tmp/tastedna-medication-db-check
```

Observed: all seven migrations applied; 29 database assertions passed. These exercise owner isolation, anonymous denial, write bounds, consent defaults, revision changes, invalidation on acceptance/save/opt-out/delete, stale revision rejection, and service-only RPC grants. This single-backend runtime does not prove concurrent multi-connection scheduling or hosted configuration. No new runtime package was added to the app.

Chrome verification on September 12:

- Both authorized TasteDNA accounts were created on the deployed site and signed in successfully. The Gmail account sent a friendship request to the CMU account; CMU accepted; both accounts showed Friends after switching and reloading. No passwords or auth tokens were saved to repository files.
- Local sign-in with the CMU account succeeded using the deployed public Supabase browser configuration in ignored `.env.local`. The twelve-form list rendered; Synthroid search selected levothyroxine tablets. Save/consent controls clearly reported account persistence unavailable instead of claiming a successful save.
- The personal map used only the selected levothyroxine tablets when adopting the example menu, showing two review connections and unchanged taste scores. Example medicines stayed separate. The synthetic selection was removed after testing.
- Those local save failures preceded the production database repair below. Local authenticated group routes still lack a privileged server key; the completed group checks used the deployed app.

## Production repair and live verification — September 12, 2026

The user explicitly authorized TasteDNA Supabase/Vercel access through the vszhu Chrome profile. This supersedes the earlier missing-authorization blocker. The Supabase project was checked against the deployed public browser configuration before making changes.

The save error was a deployment-order problem: the app from PR #31 was live, but production had only the first six migrations. Both `user_medication_profiles` and the medication persistence wrapper were absent. Applied `202609120005_medication_profiles.sql` in a transaction, recorded version `202609120005` in `supabase_migrations.schema_migrations`, and requested a PostgREST schema reload. The transaction succeeded. Follow-up SQL confirmed RLS enabled, one migration-history entry, browser/authenticated execution of the wrapper denied, and service-role execution allowed. No auth or Vercel environment settings needed changes; no admin credentials were copied into the repository.

Real Chrome checks on [the deployed app](https://taste-dna-seven.vercel.app):

1. The Gmail test account saved a synthetic fexofenadine list with group consent and restored it on reload. After signing out and signing in as the CMU account, that list was absent. The CMU account saved a separate synthetic linezolid list and restored it on reload.
2. Signing into Gmail in a separate Chrome profile restored its original fexofenadine list and consent. This verifies account persistence across browsers, beyond same-tab draft restoration.
3. Completed initial synthetic food ratings for the two previously empty test profiles. Created `Medication workflow test · Sep 12` with existing shared menus from Au Bon Pain, Baroque Toast, and Capital Grains. The invited friend accepted and both members saved their meal check-ins.
4. With both nonempty medication lists connected, computation returned the explicit medication/ingredient-review error and assigned no dish. These candidate menus lack ingredient details; the ingestion code starts with empty ingredients and an unknown description. This is a demonstrated limitation of menu evidence, not a medication-save failure. Do not weaken review rules or fabricate ingredients to make a demo pass.
5. As a control, saved explicit empty lists with consent for both accounts. A real persisted result used `fair-group-v1.1.0-meds`, showed **2 of 2** members connected, and assigned separate dishes using their saved taste profiles.
6. Changed only the invited friend's account back to a nonempty list. Refreshing the creator's result hid the old dishes and showed **This meal needs a fresh check**. Recomputing then returned the review-needed error, proving that the friend's account list affected the creator's computation.
7. Saved the friend's opt-out without removing its list. Recomputing succeeded with **1 of 2** connected and one unchecked member. The invited friend could view the result but had no recompute control. Neither shared result page exposed medication names.
8. Verified the laptop app at `http://127.0.0.1:3010` too: the CMU account saved and reloaded a synthetic simvastatin list with group consent off. Loading that account's production settings restored the same list, confirming account sync across local and deployed origins.
9. Deleted the synthetic saved medication profiles, cleared their tab drafts, and reloaded to verify empty lists, no saved-copy controls, and consent off. Removed the synthetic food ratings as well. The requested accounts and accepted friendship remain. The clearly labeled test session remains; medication-profile deletion invalidates its results.

GitHub reported Vercel deployment success for main `344424d` during this verification. The application code needed no further changes for this repair.

Successful assignment with **nonempty** medication lists and sufficiently detailed real menus remains unverified live. Per-dish filtering with complete ingredient data is covered by automated tests. Hosted concurrent multi-connection races and live photo extraction were not tested in this repair.

## Future release checks

- Apply pending migrations in order **before** deploying dependent app code. Check hosted migration history and object existence; a GitHub merge or Vercel success does not apply SQL migrations. Do not blindly rerun this non-idempotent table-creation migration in a project where it is already recorded.
- If the generic account-save error returns, check the correct project, table/RLS/grants, PostgREST schema availability, verified login, and owner profile. Keep the error visible; never claim a failed save is persisted or silently disable group checks.
- Fetch current main before changes or merging, preserve teammates' work, and keep secrets out of code and documentation. Local friend/group server testing still needs the documented server-only configuration; production passed without changing its existing environment.
