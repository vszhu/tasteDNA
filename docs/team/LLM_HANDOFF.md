# TasteDNA instructions for the next LLM

Read this before modifying the medication, account, friendship, or group flows. Follow the user's current task and the repository instructions. This document describes the state observed on **September 12, 2026**; check current code, Git history, and service status before treating an observation as current.

## Start here

1. Inspect `git status` and the current branch. Preserve existing work; do not reset or overwrite another contributor's changes.
2. Read the relevant guide in the installed `node_modules/next/dist/docs/` before changing Next.js code, as required by [AGENTS.md](../../AGENTS.md).
3. Read the applicable documents below. Keep domain logic in the existing libraries and external service calls behind their current client/server boundaries.
4. Work on a focused branch, review the diff, and follow the [team workflow](README.md) within the user's authorized scope. Do not send team messages without authorization.
5. After making changes, update the relevant handoff with what changed, what was actually tested, and any remaining blockers. Keep credentials out of code, fixtures, logs, PRs, and documentation.

| Area | Read first |
| --- | --- |
| Medication map, menu screening, privacy | [MEDICATION_CHECKS.md](../MEDICATION_CHECKS.md) |
| Password accounts and friendship refresh | [FRIENDSHIP_PASSWORD_FLOW_HANDOFF.md](FRIENDSHIP_PASSWORD_FLOW_HANDOFF.md) |
| Meal invite links, sign-in return paths, and local-to-live sharing | [INVITE_LINK_HANDOFF.md](INVITE_LINK_HANDOFF.md) |
| Friendship endpoints, auth configuration, hosted migration dependency | [DEVELOPER_3_AUTH_FRIENDSHIP_FIX_HANDOFF.md](DEVELOPER_3_AUTH_FRIENDSHIP_FIX_HANDOFF.md), [DEVELOPER_3_TASK_5_HANDOFF.md](DEVELOPER_3_TASK_5_HANDOFF.md) |
| Persistence, menus, and platform integration | [DEVELOPER_3_TASK_4_HANDOFF.md](DEVELOPER_3_TASK_4_HANDOFF.md) |
| Real group-session API and UI integration | [DEVELOPER_3_TASK_6_HANDOFF.md](DEVELOPER_3_TASK_6_HANDOFF.md) |
| Group scoring and contracts | [DEVELOPER_2_TASK_6_GROUP_CONTRACT_MAINTENANCE.md](DEVELOPER_2_TASK_6_GROUP_CONTRACT_MAINTENANCE.md) |

## What has merged

| Main commit | Change | Verification at that revision |
| --- | --- | --- |
| `aa0a30d` | Medication-aware dining and interactive medicine → food term → dish map | 231 tests, lint, production build, local browser flow checks |
| `9ea79c4` / PR #25 | Friends page connected to real HTTP endpoints; actionable auth email errors | See the developer 3 handoff |
| `4516ba0` / [PR #26](https://github.com/vszhu/tasteDNA/pull/26) | Password signup/sign-in, account switching, public-profile bootstrap, reliable friend refresh | 254 tests in 49 files, lint, production build; local Chrome account-screen checks |
| `945986b`, integrated through `f6b20ba` | Authenticated group-session and recommendation backend, with migration `202609120004_group_session_api.sql` | Developer 3 reports local application and database checks in the Task 6 handoff; combined live verification is still outstanding |
| `3625ff0`, integrated through `8bdb4c4` | Group UI connected to the real API; mock session/friend adapters removed | Developer 3 reports 271 tests plus lint/build; hosted state must still be verified |
| `344424d` / [PR #31](https://github.com/vszhu/tasteDNA/pull/31) | Twelve medication forms, private account lists, and each member's saved consent/list in group dining | 334 tests in 57 files, lint/build, 29 isolated database checks; production migration and two-account workflow verified afterward as detailed below |

These are historical check results, not substitutes for testing later changes. A GitHub merge is not proof that Vercel deployed it or that a hosted migration ran.

The Task 6 backend and UI integration are now in `main`. Do not reimplement them or infer hosted migration state from their presence in the repository.

## Preserve these integration rules

### Accounts and friendships

- `src/lib/auth/supabase-adapter.ts` owns Supabase password and magic-link operations. `src/components/providers/session-provider.tsx` exposes verified users and bootstraps `public.users`. Password logins do not visit `/auth/callback`, so they must still create the public profile needed by friendship and taste persistence.
- Signup returning no session means confirmation is still required. Never show that user as authenticated just because signup returned a user object. Surface provider errors without exposing raw private details.
- Keep generation checks around asynchronous auth work: a late initial lookup, verification, or profile write must not restore a previous account after switching or signing out. Sign-out errors must remain visible.
- `src/app/friends/page.tsx` uses `src/lib/friendships/client.ts`, not `mockFriendsAdapter`. Its account-specific child is keyed by user ID, aborts obsolete reads, refreshes after mutations/on focus/every 15 seconds while visible, and offers manual retry. Do not replace failed reads with a false empty-state success.
- Friendship APIs live under `src/app/api/friendships/`; authorization and persistence live in `src/lib/friendships/`. Verify the requester server-side. Keep privileged email lookup on the server and ordinary participant access protected by RLS.
- Preserve neutral request responses for created, existing, and unknown-email cases. Do not reveal whether an arbitrary email is registered. Only the pending request's addressee can accept or decline it.
- Rejected relationships currently remain terminal because of the unique unordered-pair schema. Do not assume a declined pair can be reused for another request without an explicit product/schema change.
- The session pages now use the real clients in `src/lib/group-sessions/client.ts` and `src/lib/friendships/client.ts`; the old mock adapters were removed. Preserve this integration and verify the live service separately from local UI tests.
- The backend lives in `src/app/api/group-sessions/` and `src/lib/group-sessions/`. Keep raw member profiles and other members' meal preferences private on the server; only the creator can compute the derived recommendation. Read the Task 6 handoff before changing these routes or the connected UI.
- Preserve a validated `next` destination through invite sign-in, account switching, signup/email callbacks, and callback errors. Password navigation waits for verified provider state. A copied URL never grants membership. See [INVITE_LINK_HANDOFF.md](INVITE_LINK_HANDOFF.md) for the reproduced failure, public URL configuration, and browser verification status.

### Medication map and taste data

- Provider composition is Session → Taste → Medication inside the application layout. Medication state is separate from the taste profile.
- The user explicitly extended the original tab-only medication scope to private account saving and group use. Anonymous/unsaved lists stay in account-scoped `sessionStorage`; explicit saves go to owner-only `user_medication_profiles`. Group use is off by default and requires saved consent. The server uses each accepted member’s opted-in list to exclude review-needed dish options. Never include medication names in taste records, shared menus, shared group payloads, extraction prompts, or learning inputs. Preserve account-switch masking, RLS, error states, and revision-based result invalidation. Read the expansion/group handoff before editing this boundary.
- `src/lib/medications/catalog.ts`, `check.ts`, and `map.ts` define rule coverage, deterministic screening, and graph paths. `src/components/medications/interaction-explorer.tsx` renders the shared explorer used by medications and results.
- The map connects medicines to covered food terms and dishes; shared nodes must not imply drug–drug interactions. Preserve rule ownership and evidence on every highlighted path.
- Keep medication review order separate from taste scores. With no medications, preserve the original taste ranking and explanation behavior. Unknown medicines and incomplete evidence must remain visibly unverified; “No listed match” is not a safety guarantee.
- Example-lab medicines are temporary and separate from the user's actual list. Adopting a sample menu from medications, decoder, or empty results changes the menu only; it must not replace saved ratings or medications. Explicit full-profile demo actions are different.
- Check the medication document before expanding coverage. Verify exact formulations and authoritative sources; do not invent clinical claims or turn taste scores into medical safety probabilities.
- Catalog `2026-09-12.2` covers 12 forms. Preserve the distinction between tablet timing, portion review, and explicit ingredient warnings. Alcohol-related contextual phrases qualify only overlapping evidence; they must not hide a separate explicit alcohol ingredient. See the [expansion handoff](MEDICATION_CATALOG_EXPANSION_HANDOFF.md) for the added medicines and verification.

## Local setup and meaningful checks

Use Node 22+ and the repository's npm scripts. The anonymous taste flow and medication explorer work without credentials. Supabase account and real friendship testing do not.

```sh
npm ci
npm run dev -- --port 3010
```

Use one consistent origin while testing auth, for example `http://127.0.0.1:3010`. Register that origin's callback in Supabase when using real auth. `localhost` and `127.0.0.1` do not share the browser's auth cookies or PKCE verifier. Do not overwrite an existing `.env.local`; use `.env.example` to identify missing variable names.

For behavior changes, run:

```sh
npm test
npm run lint
npm run build
```

Relevant regressions include `src/app/friends/page.test.ts`, `src/app/sign-in/page.test.ts`, `src/components/providers/session-provider.test.ts`, `src/lib/auth/supabase-adapter.test.ts`, the friendship HTTP/repository tests, and `src/components/providers/medication-integration.test.ts`. Component tests use `.test.ts` with a jsdom environment directive; the Vitest configuration currently selects `src/**/*.test.ts`.

Test the changed browser flow too. A mocked API test is not a live two-account test. Documentation-only edits need link/path and diff checks; do not rerun the application suite solely for prose changes.

## Current verification and release status — September 12, 2026

- Both user-authorized accounts have now been created through the deployed TasteDNA signup UI, and password sign-in succeeded. The Gmail account sent a friendship request to the CMU account; the CMU account received and accepted it. This supersedes the earlier signup/email-limit blocker. See the friendship handoff for the completed browser steps.
- The expansion started at `8bdb4c4` and then incorporated latest main `ccb1fc1`, including PR #29’s menu ingestion and PR #30’s submission docs, without overwriting them. Fetch again immediately before integrating; preserve other contributors’ commits. The group UI already uses the real backend. Do not reintroduce mock adapters.
- The twelve-form catalog and private group integration pass 334 application tests in 57 files, lint, and the production build. The isolated database harness applied all seven migrations and passed 29 checks covering RLS, validation, consent defaults, invalidation, stale revision rejection, and RPC authorization. This is local verification, not a hosted migration or multi-connection concurrency test.
- Local browser auth is configured using the deployed app’s public Supabase URL/publishable key in ignored `.env.local`. No privileged server key was obtained. Local friend/group server operations still require the documented server-only environment variables.
- After PR #31 merged, the user explicitly authorized Supabase/Vercel access via the vszhu Chrome profile. Production still had only the first six migrations, causing the account-save error. Applied and recorded `202609120005_medication_profiles.sql` transactionally, then reloaded the PostgREST schema. Hosted checks confirmed RLS enabled and the group persistence wrapper executable only by the server role among the tested browser/server roles. No auth settings or Vercel environment changes were needed. The earlier console-authorization blocker is resolved for this authorized repair.
- Deployed Chrome verification passed: distinct account medication saves, reload/sign-in restoration, cross-browser persistence, two-account isolation, accepted group invitation/check-ins, empty-list control computation, invalidation after only the friend's list changed, and saved opt-out changing coverage from 2/2 to 1/2. Shared results exposed no medication names. Removed synthetic medication profiles/drafts and food ratings; retained the accounts, accepted friendship, and clearly labeled test session.
- Laptop medication saving also passed: a synthetic list saved and restored at `http://127.0.0.1:3010` appeared under the same account on the production site, then was deleted. This confirms local account saving; local group server configuration remains a separate requirement. Vercel reported deployment success for main `344424d`.
- The real candidate menus in that test lack ingredient details. Nonempty medication lists therefore correctly held every candidate for review instead of assigning an unchecked dish. A successful live assignment with nonempty lists and sufficiently detailed menus remains unverified; per-dish filtering is tested with automated fixtures. Do not mistake missing ingredient evidence for a save failure or remove the review safeguard.
- On future deployments, apply new migrations before dependent app code and verify hosted history. Migration `202609120005` is already applied in the tested production project; do not rerun its table creation blindly. The repair required no application code changes, so its documentation-only follow-up uses link/diff checks rather than repeating the application suite.
- Historical Vercel status for `4516ba0` was “Deployment was blocked,” but later teammate code is now deployed with password auth and real friendships. Check the new revision’s actual deployment status; a merge is not deployment proof. Never spoof commit authorship to bypass hosting controls.

The detailed implementation and release checklist are in [MEDICATION_CATALOG_EXPANSION_HANDOFF.md](MEDICATION_CATALOG_EXPANSION_HANDOFF.md). Do not label uncompleted hosted medicine/group checks as passed.
