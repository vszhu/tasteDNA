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
| Friendship endpoints, auth configuration, hosted migration dependency | [DEVELOPER_3_AUTH_FRIENDSHIP_FIX_HANDOFF.md](DEVELOPER_3_AUTH_FRIENDSHIP_FIX_HANDOFF.md), [DEVELOPER_3_TASK_5_HANDOFF.md](DEVELOPER_3_TASK_5_HANDOFF.md) |
| Persistence, menus, and platform integration | [DEVELOPER_3_TASK_4_HANDOFF.md](DEVELOPER_3_TASK_4_HANDOFF.md) |
| Real group-session API and remaining UI integration | [DEVELOPER_3_TASK_6_HANDOFF.md](DEVELOPER_3_TASK_6_HANDOFF.md) |
| Group scoring and contracts | [DEVELOPER_2_TASK_6_GROUP_CONTRACT_MAINTENANCE.md](DEVELOPER_2_TASK_6_GROUP_CONTRACT_MAINTENANCE.md) |

## What has merged

| Main commit | Change | Verification at that revision |
| --- | --- | --- |
| `aa0a30d` | Medication-aware dining and interactive medicine → food term → dish map | 231 tests, lint, production build, local browser flow checks |
| `9ea79c4` / PR #25 | Friends page connected to real HTTP endpoints; actionable auth email errors | See the developer 3 handoff |
| `4516ba0` / [PR #26](https://github.com/vszhu/tasteDNA/pull/26) | Password signup/sign-in, account switching, public-profile bootstrap, reliable friend refresh | 254 tests in 49 files, lint, production build; local Chrome account-screen checks |
| `945986b`, integrated through `f6b20ba` | Authenticated group-session and recommendation backend, with migration `202609120004_group_session_api.sql` | Developer 3 reports local application and database checks in the Task 6 handoff; combined live verification is still outstanding |

These are historical check results, not substitutes for testing later changes. A GitHub merge is not proof that Vercel deployed it or that a hosted migration ran.

The Task 6 handoff was written before its commit and merge; its “not committed, pushed, merged” state and initial deployment steps are historical. The backend is now in `main`. Do not reimplement it or reapply already-applied migrations based on that older wording.

## Preserve these integration rules

### Accounts and friendships

- `src/lib/auth/supabase-adapter.ts` owns Supabase password and magic-link operations. `src/components/providers/session-provider.tsx` exposes verified users and bootstraps `public.users`. Password logins do not visit `/auth/callback`, so they must still create the public profile needed by friendship and taste persistence.
- Signup returning no session means confirmation is still required. Never show that user as authenticated just because signup returned a user object. Surface provider errors without exposing raw private details.
- Keep generation checks around asynchronous auth work: a late initial lookup, verification, or profile write must not restore a previous account after switching or signing out. Sign-out errors must remain visible.
- `src/app/friends/page.tsx` uses `src/lib/friendships/client.ts`, not `mockFriendsAdapter`. Its account-specific child is keyed by user ID, aborts obsolete reads, refreshes after mutations/on focus/every 15 seconds while visible, and offers manual retry. Do not replace failed reads with a false empty-state success.
- Friendship APIs live under `src/app/api/friendships/`; authorization and persistence live in `src/lib/friendships/`. Verify the requester server-side. Keep privileged email lookup on the server and ordinary participant access protected by RLS.
- Preserve neutral request responses for created, existing, and unknown-email cases. Do not reveal whether an arbitrary email is registered. Only the pending request's addressee can accept or decline it.
- Rejected relationships currently remain terminal because of the unique unordered-pair schema. Do not assume a declined pair can be reused for another request without an explicit product/schema change.
- `src/app/sessions/new/page.tsx` still uses `mockFriendsAdapter` and `mockSessionAdapter`. Real friendship acceptance is **not** evidence that real group invitations or shared group sessions work. Treat that integration as separate unfinished work.
- The backend for that integration now exists in `src/app/api/group-sessions/` and `src/lib/group-sessions/`. Use its validated route contracts when replacing the mock UI. Keep raw member profiles and other members' meal preferences private on the server; only the creator can compute the derived recommendation. Read the Task 6 handoff before wiring these routes.

### Medication map and taste data

- Provider composition is Session → Taste → Medication inside the application layout. Medication state is separate from the taste profile.
- Medication lists stay in account-scoped browser-tab `sessionStorage`. Never include them in Supabase taste records, shared menus, group payloads, extraction prompts, or recommendation-learning inputs. Keep account-switch masking and storage-error handling.
- `src/lib/medications/catalog.ts`, `check.ts`, and `map.ts` define rule coverage, deterministic screening, and graph paths. `src/components/medications/interaction-explorer.tsx` renders the shared explorer used by medications and results.
- The map connects medicines to covered food terms and dishes; shared nodes must not imply drug–drug interactions. Preserve rule ownership and evidence on every highlighted path.
- Keep medication review order separate from taste scores. With no medications, preserve the original taste ranking and explanation behavior. Unknown medicines and incomplete evidence must remain visibly unverified; “No listed match” is not a safety guarantee.
- Example-lab medicines are temporary and separate from the user's actual list. Adopting a sample menu from medications, decoder, or empty results changes the menu only; it must not replace saved ratings or medications. Explicit full-profile demo actions are different.
- Check the medication document before expanding coverage. Verify exact formulations and authoritative sources; do not invent clinical claims or turn taste scores into medical safety probabilities.

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

## Live blockers and next steps

The following was observed during the September 12 test and push:

- Both authorized account password sign-ins returned `invalid_credentials`. A signup attempt returned HTTP 429 `over_email_send_rate_limit`, and further signup attempts stopped. Neither requested account was verified as created. No real request/acceptance between those accounts was completed.
- The earlier developer 3 handoff reported `supabase/migrations/202609120003_friendship_api.sql` pending on the hosted project. This later test could not verify its current application status. Migration presence in Git does not mean it exists in the hosted database.
- The newly merged group backend also requires `supabase/migrations/202609120004_group_session_api.sql`. Its hosted application status is unverified; inspect pending migrations and preserve their order before testing the real group API.
- At the time of testing, the local checkout had no configured Supabase credentials or linked project, and the dashboard required sign-in. Browser auth needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy anon-key fallback exists). The friendship server also requires `SUPABASE_SECRET_KEY` (legacy service-role fallback exists). Privileged keys must never be public browser variables.
- Vercel's GitHub status for merged commit `4516ba0` said **“Deployment was blocked.”** The exact dashboard reason was not available. Do not label this a compilation failure: the local production build passed. Do not change commit authorship to impersonate someone else as a workaround.

To finish live verification when the required access is available:

1. Inspect Vercel's current deployment details and resolve the actual reported blocker through the project owner's access/settings. Confirm the deployed commit before testing new UI.
2. Inspect Supabase email delivery, confirmation, and callback configuration. Resolve the provider's mail restriction; do not bypass confirmation or repeatedly retry a rate-limited signup. Password login avoids a new magic-link email only after a usable account exists.
3. Confirm the Supabase project identity and review pending migrations with `supabase db push --dry-run`. Apply the required migration within authorized scope after reviewing its effects. Verify server environment configuration without exposing key values.
4. Complete signup and email confirmation for the user-authorized accounts. Obtain test credentials through the current authorized session; none are stored here. Do not create unrelated accounts or alter a Google account's password.
5. Sign in as A and request B. Confirm A sees outgoing pending; sign in as B and confirm incoming pending. Accept, then verify both accounts show the friendship after focus/refresh. Also check a reload, sign-out, and switching accounts for stale data.
6. Use a separate relationship to test decline because rejected pairs are terminal. Verify unauthorized users cannot accept someone else's request. Do not describe group invitations as verified unless their separate real implementation has been exercised.
7. Record the actual deployed revision, results, and remaining limitations in the feature handoff. Update this document's status if a blocker is resolved.
