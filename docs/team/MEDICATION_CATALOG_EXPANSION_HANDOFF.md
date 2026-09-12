# Medication catalog and private friend-circle integration

Read [LLM_HANDOFF.md](LLM_HANDOFF.md) and [MEDICATION_CHECKS.md](../MEDICATION_CHECKS.md) first. This change started from main `8bdb4c4` and incorporated latest main `ccb1fc1` (PRs #29 and #30); fetch main again immediately before merging. The user requested more medicines, testing with their two authorized accounts, and group recommendations based on each person's account list. That explicitly extends the earlier tab-only feature scope.

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
- Hosted account medication saving and the real group meal recompute are **not verified yet**. The new migration is not applied. Local authenticated group routes also lack a privileged server key. Unit/database checks are not a substitute for these live steps.

## Release steps still requiring access

1. Obtain explicit authorization to access the TasteDNA Supabase console/database. Automatic approval review previously rejected opening the dashboard because private console access had not been explicitly authorized. Do not bypass that decision with admin APIs, another browser surface, or secret discovery.
2. With authorization, verify the correct project and pending migration order. Apply the reviewed medication migration without changing auth settings or unrelated data. Configure server-only variables if missing; never expose their values or move them to `NEXT_PUBLIC_*`.
3. Fetch current main, integrate teammate changes, review the combined diff, and run required checks. The user explicitly authorized a careful merge after testing. Use the normal PR/squash workflow and actual commit identity, then verify the deployed revision.
4. Using the authorized test accounts, save distinct synthetic lists and group consent, reload, switch accounts, and verify isolation. Use valid existing shared menus and saved taste profiles to test group creation, acceptance, per-person dish filtering, opt-out, and fresh recomputation after a list changes. Do not create misleading shared restaurant menus as test data.
5. Remove synthetic test medication lists and record precisely what passed. Retain the requested test accounts and accepted friendship. Do not claim that a GitHub merge applied a migration or completed deployment.
