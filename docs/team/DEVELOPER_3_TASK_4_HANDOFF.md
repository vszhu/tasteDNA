# Developer 3 Platform Handoff: Tasks 1–4

Last updated: 2026-09-12  
Current Task 4 branch: `feat/dev-3-task-4`  
Task 4 state at the time of this handoff: implemented and verified locally, but not committed, pushed, or deployed

This is the implementation record for Developer 3's first four backend tasks. Read it with:

- [Developer 3's ownership guide](./DEVELOPER_3_PLATFORM.md)
- [the team workflow](./README.md)
- `src/types/group.ts`, which is the shared group-domain contract owned by Developer 2
- the original Developer 3 task brief, if it is available outside this repository

The task brief describes intended behavior. This file describes what is actually in the repository, where it differs, what failed during implementation, and what later work must account for.

## Current integration state

| Task | Repository state | Main implementation | Deployment state |
| --- | --- | --- | --- |
| 1. Group schema and RLS | Merged into `main` at `cc5573b` (with earlier duplicate history described below) | `supabase/migrations/202609110002_group_dining_foundation.sql` | Confirmed pushed to the linked Supabase project |
| 2. CMU Dining sync and venue API | Merged into `main` at `3fe62c5` | `src/lib/cmu-dining/`, `/api/admin/cmu-dining/sync`, `/api/venues` | Confirmed working; one manual sync inserted 45 live venue records |
| 3. Auth and durable TasteDNA | Merged into `main` at `3f0400c` | `src/lib/auth/`, authenticated taste repository, auth callback/proxy, migration `202609120001_auth_taste_persistence.sql` | Remote migration deployment has not been independently confirmed in this work log |
| 4. Shared menu ingestion | Local changes on `feat/dev-3-task-4` | shared-menu modules, extraction integration, venue-menu reads, migration `202609120002_shared_menu_ingestion.sql` | Not pushed to GitHub or Supabase |

Do not infer remote database state from Git history. Before using Tasks 3 or 4 against the hosted project, run a migration dry run and inspect exactly what Supabase plans to apply:

```powershell
npx supabase@latest db push --dry-run
```

## Task 1 — Group dining schema and RLS

### What was implemented

Task 1 added the additive group foundation in `202609110002_group_dining_foundation.sql`:

- `venues`, including deterministic external identity, coordinates, source data, content hashes, timestamps, and active state.
- Version/source/freshness fields on the existing `menus` table, rather than a competing menu model.
- `friendships`, including self-request prevention and unordered uniqueness so reversed requests cannot duplicate a relationship.
- `group_sessions`, `group_session_members`, `group_session_candidates`, `group_session_meal_preferences`, and `group_recommendation_results`.
- Automatic accepted creator membership for every new group session.
- Private `security definer` membership/friendship helpers with an empty search path.
- Explicit table grants, RLS policies, and transition triggers for creator, invitee, accepted-member, declined-member, outsider, anonymous, and service-role behavior.
- pgTAP policy and integrity coverage under `supabase/tests/database/`.

The existing solo data model remains valid. Group membership does not grant access to another person's raw ratings, full taste profile, or meal-state JSON.

### Differences from the original plan

- The final implementation stayed additive and reused the existing `users`, `ratings`, `taste_profiles`, `menus`, and recommendation structures as intended.
- The shared TypeScript group contract had not landed when this migration was authored, so JSONB state/result columns intentionally remained contract-neutral.
- Email remains in `auth.users`; no public email directory or discovery column was added.
- The database's status vocabulary now differs from the later shared TypeScript contract. This is not safe to pass through directly:

| Concept | Database values | `src/types/group.ts` values |
| --- | --- | --- |
| Friendship | `pending`, `accepted`, `rejected` | `pending`, `accepted`, `declined` |
| Session | `planning`, `decided`, `closed` | `draft`, `open`, `revealed`, `cancelled` |
| Member | `invited`, `accepted`, `declined` | `invited`, `joined`, `declined`, `responded` |

Task 5 and especially Task 6 need an explicit repository/API mapping or a small agreed migration/contract change. Do not return database rows as shared contract objects without resolving this mismatch.

### Issues encountered and resolutions

- Work was split across several branches/PRs and then merged out of order. Git history therefore contains earlier Task 1 commits `4a0dc88` and `ee4dfed`, merge commit `8f7f523`, and the later merged PR at `cc5573b`. The current schema should be judged by the migration file in current `main`, not by replaying assumptions from an earlier PR.
- A crashed/overlapping Git merge editor left `.git/.MERGE_MSG.swp`. The merge was recovered/finished without discarding source changes. This was a Git workflow issue, not a database feature.
- Supabase initially lacked the migrations remotely, which caused later server operations to fail. The user linked the CLI project and successfully pushed `202609110001_initial_tastedna.sql` and `202609110002_group_dining_foundation.sql`.

### Effect on later tasks

- Task 4 must continue reusing the extended `menus` table. It must not add another venue-menu ownership model.
- Task 5 must use the existing friendship row, unordered uniqueness rule, and transition policies. Only accepted friendships may be used for session invitations.
- Task 6 must use the existing session/member/candidate/preference/result tables and preserve their RLS boundaries. It must map the status vocabulary noted above.
- Developer 1 may display derived session output, but must never fetch another member's raw ratings/profile/meal-state data.
- Developer 2's group engine should receive profiles only through a trusted server-side orchestration layer; the profiles must not be embedded in the public group result.

## Task 2 — CMU Dining adapter, sync, and venue API

### What was implemented

Task 2 added:

- A Zod-validated CMU/ScottyLabs adapter in `src/lib/cmu-dining/`.
- Deterministic source identities in the form `cmu:<conceptId>` and stable database UUID mapping.
- Normalization for coordinates, hours, menu links, specials, soups, source metadata, hashes, and observed/source timestamps.
- A checked-in sanitized last-good fixture for tests and demo outages.
- An idempotent, bearer-protected manual sync route at `POST /api/admin/cmu-dining/sync`.
- A public cached venue route at `GET /api/venues`.
- Tests for malformed data, fallback behavior, duplicate/changed sync behavior, and public mapping.

Normal page loads read cached Supabase data or the fixture. They do not invoke OpenAI or resynchronize CMU automatically.

### Differences from the original plan

- The implementation supports Supabase's current publishable/secret keys while temporarily retaining legacy-key fallbacks:
  - Browser/authenticated client: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - Privileged server client: `SUPABASE_SECRET_KEY`
  - Legacy fallback only: `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
- `CMU_DINING_SYNC_SECRET` is an application-chosen bearer password, not a credential downloaded from CMU or Supabase. It protects the manual admin route and is necessary if that route is enabled.
- Public API venue IDs are database UUIDs. UI code must not assume fixture slugs or `cmu:<conceptId>` values are the public `Venue.id`.

### Issues encountered and resolutions

- `Unable to connect to the remote server` meant the local Next.js development server was not listening. Running `npm run dev` and waiting for the ready message resolved it.
- `401 Unauthorized` meant the request's `Authorization: Bearer ...` value did not match `CMU_DINING_SYNC_SECRET` in the running server environment. Restarting the server after correcting `.env.local` and sending the exact raw localhost URL resolved it.
- `502 Bad Gateway` initially meant the server could reach Supabase but the required remote schema was absent. After linking the project and pushing Task 1 migrations, the same call succeeded.
- The successful result `received: 45`, `inserted: 45` means 45 upstream venue records were validated and written to the `venues` cache. It does not mean 45 menus were extracted and it does not trigger group recommendations.

### Effect on later tasks

- Developer 1's map and candidate picker should consume `GET /api/venues`, not call the upstream dining feed directly.
- Task 4 attaches shared menus to the UUID returned as `Venue.id`.
- Task 6 should load candidate venues from the database and use their newest valid shared menus. It should not sync upstream during recommendation computation.
- A failed live feed does not necessarily make the demo unusable because the last-good fixture remains available.
- Never put `SUPABASE_SECRET_KEY` or `CMU_DINING_SYNC_SECRET` in client components or a `NEXT_PUBLIC_` variable.

## Task 3 — Supabase auth and durable TasteDNA persistence

### What was implemented

Task 3 added:

- Supabase email magic-link support with both code exchange and token-hash callback handling.
- Browser and cookie-aware server clients using `@supabase/ssr`.
- Next.js 16 session refresh through `src/proxy.ts`.
- Server helpers such as `getCurrentUser()` and `getCurrentTasteProfile()`.
- User bootstrap and an authenticated repository adapter for existing `Rating` and `TasteProfile` shapes.
- Signed-in persistence through Supabase while preserving anonymous state in localStorage under `tastedna-v1`.
- Migration `202609120001_auth_taste_persistence.sql` and unit/pgTAP coverage.

Server code verifies the current user rather than trusting a client-supplied identity or unverified session payload.

### Differences from the original plan

- Anonymous state is not silently imported when a user signs in. Import/merge UX was explicitly deferred so a sign-in cannot unexpectedly overwrite either data set.
- Existing schema and app identifiers were incompatible in two places:
  - The app uses stable text dish IDs, while `ratings.dish_id` is UUID.
  - The current deterministic embedding provider produces 64 dimensions, while the original database vector is `vector(1536)`.
- The additive migration therefore keeps nullable canonical `dish_id`, adds client identity/snapshot fields for ratings, and stores the complete versioned taste state in `taste_profiles.profile_state` JSONB. It does not destructively change the original vector column.

### Issues encountered and resolutions

- `@supabase/ssr` was referenced by Task 3 source code but had not been successfully installed or locked when the Task 3 PR merged. At the start of Task 4, the suite passed 99 tests and failed only on module resolution. Installing `@supabase/ssr@^0.12.7` repaired `package-lock.json`; the repaired Task 3 suite passed 102 tests, lint, and type checking before Task 4 changes.
- The original Task 3 pgTAP test attempted an anonymous `SELECT` on owner-private tables even though anonymous table grants were intentionally revoked. Task 4's isolated database validation exposed this. The test now checks `has_table_privilege(..., 'SELECT') = false` instead of issuing a query the role must not be allowed to execute.

The lockfile repair and pgTAP correction are currently present in the Task 4 working tree. Reviewers should recognize them as compatibility repairs for the already-merged Task 3 implementation, not shared-menu behavior.

### Effect on later tasks

- Tasks 5 and 6 should reuse `getCurrentUser()` and the authenticated cookie client. They must not create a second auth/session system.
- Server group computation may use `getCurrentTasteProfile()` or the repository layer to assemble private inputs. Public responses must contain only derived recommendations/utilities.
- Client code uses the publishable key plus RLS. Privileged ingestion/sync uses the secret key only on the server.
- Anonymous solo mode must continue reading/writing `tastedna-v1`; friendship, shared venue mutation, and group participation require authentication.
- Developer 1 should treat sign-in and persistence as optional for the solo flow, and required only when entering social/group features.

## Task 4 — Versioned shared menu ingestion

### What was implemented locally

Task 4 extends the existing extraction pipeline instead of replacing it:

- `POST /api/menu/extract` accepts an optional UUID `venueId` form field.
- Without `venueId`, the existing anonymous one-off decoding behavior is preserved and no shared database write occurs.
- With `venueId`, the route verifies the signed-in user and active venue before paid/model work, normalizes the extracted menu, and persists it using a server-only transaction RPC.
- `src/lib/menu/shared-normalize.ts` canonicalizes names/text/features, computes stable SHA-256 menu/dish hashes, rounds numeric data, and prepares the current deterministic ranking embedding.
- `src/lib/menu/shared-authorization.ts` verifies authenticated uploads and active venue targets.
- `src/lib/menu/shared-repository.ts` ingests shared menus and reads the newest valid menu for venue ranking.
- `src/lib/menu/shared-selection.ts` deterministically chooses the highest valid version and labels it `fresh` or `stale` using the current 30-day freshness window.
- `GET /api/venues` now enriches venues with the selected shared `menuItems`, `menuFreshness`, and `menuUpdatedAt`. Venue discovery still succeeds if the shared-menu read fails.
- Migration `202609120002_shared_menu_ingestion.sql` adds ranking metadata, menu-item category, current-version indexing, refined RLS, explicit grants, and service-only `ingest_shared_menu(...)`.
- The RPC locks the active venue, validates input, reuses identical venue/content hashes, increments the version for changed content, closes the former current version, and writes menu/dish/features/items atomically.
- Raw menu images and base64 payloads are not stored. Source metadata records that raw image storage is disabled.

### Intentional differences from the original plan

- The implementation reuses Task 1's `menus`, `dishes`, `dish_features`, and `menu_items`; there is no new competing shared-menu table.
- Current ranking embeddings are stored as versioned JSONB (`ranking_embedding`) because the app's deterministic embedding is 64-dimensional and the older pgvector column is fixed at 1536 dimensions. The original vector column stays nullable for a future production embedding provider.
- Multi-table ingestion is an atomic, service-only Postgres RPC. Performing several ordinary PostgREST writes would not provide one transaction boundary.
- Shared menu availability is integrated into the existing `GET /api/venues` response instead of adding a separate candidate-menu endpoint.
- No new menu-upload UI was added. The backend accepts `venueId`; Developer 1 may wire a venue selector separately.
- In no-OpenAI demo mode, venue-targeted pasted text may use the deterministic local parser. Venue-targeted images return a safe unavailable response rather than incorrectly saving the generic sample fixture as a real venue menu.

### Authorization behavior

- Anonymous extraction without `venueId`: allowed, one-off, not persisted.
- Authenticated extraction without `venueId`: same one-off behavior unless a caller supplies a venue.
- Venue-targeted extraction: requires a valid signed-in user, an active venue, and configured server secret access.
- Browser roles cannot execute `ingest_shared_menu(...)` directly.
- Active shared menus and their menu items are publicly readable for venue discovery/ranking.
- Private owner menus remain owner-managed and are not made public by group access.
- Authenticated direct table writes cannot attach a menu to a venue; shared attachment goes through the validated server RPC.

### Issues encountered and resolutions

- The pre-existing local Supabase Docker volume was PostgreSQL 15, while the current CLI attempted PostgreSQL 17. The database container entered a restart loop. The old volume was preserved, not deleted.
- Database tests were run in an isolated temporary Supabase project using separate ports and a fresh PostgreSQL 17 volume. All migrations applied there.
- The first pgTAP pass exposed the Task 3 permission-test issue described above and a Task 4 `throws_ok` overload error. The latter was corrected to provide both the expected error text and the test description explicitly.
- The temporary validation stack and files were removed after testing; the user's old local volume remains present.
- `npm install` reports two moderate dependency vulnerabilities. No forced audit fix was applied because that could introduce unrelated breaking changes.

### Verification completed

- Unit/integration tests: 32 files, 114 tests passed.
- Database tests: 3 pgTAP files, 72 tests passed in the isolated Supabase stack.
- ESLint: passed.
- TypeScript (`npx tsc --noEmit`): passed.
- Production build: passed. The webpack compile was unusually slow in this environment but completed successfully.

### Effect on later tasks

- Developer 1 can render `Venue.menuItems`, `Venue.menuFreshness`, and `Venue.menuUpdatedAt` from `GET /api/venues`. A venue can legitimately have an empty menu and `unknown` freshness.
- Developer 2 should score the concrete `Dish` values reconstructed by the shared-menu repository. Do not read or assume the old 1536-dimensional vector for current deterministic ranking.
- Task 6 should call the shared-menu repository once for candidate venues, reject/label candidates with no usable menu according to agreed product behavior, and pass the returned concrete dishes to the pure group engine.
- Stale menus remain retrievable and are explicitly labeled. The UI/engine must decide how visibly to warn or penalize them; do not silently present stale data as fresh.
- Upload authorization currently means any authenticated user may target an active venue through the server route. If the product later needs curator/moderator ownership, add that concept deliberately rather than weakening the existing service-only write boundary.

## Cross-team integration notes

### Developer 1 — Product and UI

- Keep consuming the shared `Venue` and group types; do not duplicate backend row shapes in components.
- Use `GET /api/venues` as the map/menu source. Handle `fresh`, `stale`, and `unknown` plus an empty `menuItems` list.
- A future upload UI should send `venueId` only when the user intentionally chose the venue. Omitting it preserves private one-off decoding.
- Preserve the optional anonymous solo journey. Require sign-in at the social/group boundary, not app launch.
- Never render or request another member's raw taste profile, ratings, or temporary preference JSON.

### Developer 2 — Taste engine and ranking

- `src/types/group.ts` remains the domain contract. The backend should adapt database values to it; the engine should not import database rows.
- Current stored ranking embeddings are 64-number JSON arrays. Keep the embedding provider boundary intact and avoid coupling algorithms to the database's legacy pgvector column.
- Shared menus provide concrete dishes and menu-item IDs for dish-grounded group scoring.
- Freshness is input metadata, not currently a hidden scoring factor. Any penalty or exclusion rule should be explicit, centralized, and covered by ranking regression tests.
- The backend will pass private member profiles into the pure compute call, but returned `GroupRecommendation` data must not expose those profiles.

### Developer 3 — Tasks 5 and 6

- Task 5 must adapt database `rejected` to contract `declined` (or coordinate a contract/schema change), preserve neutral unknown-email responses, and use server auth helpers.
- Task 5 should rely on the database's unordered friendship uniqueness and transition guard; translate constraint/policy failures into stable API errors instead of reimplementing integrity only in JavaScript.
- Task 6 must resolve all session/member status vocabulary mismatches before exposing routes.
- Task 6 should use Task 1 RLS as defense in depth, but still perform clear server-side authorization and state-transition checks.
- The compute route should batch-load accepted members' private profiles and candidates' latest valid shared menus, invoke Developer 2's pure engine exactly once, and persist only the derived versioned result snapshot.
- Recommendation snapshots should include an algorithm version and deterministic input hash. Authenticated browser clients are not allowed to insert them directly.

## Future platform-task documentation rule

For Task 5 and every later Developer 3 task, add a handoff section or a sibling handoff document before the PR is considered ready. Record:

1. The branch, commit/PR, migration names, and whether each change is only local, merged, or deployed.
2. What was implemented, including public routes, database objects, environment variables, and authorization behavior.
3. Every meaningful difference from the original task prompt and why it was chosen.
4. Problems encountered, their actual cause, and the fix or remaining limitation.
5. Compatibility effects for Developer 1, Developer 2, and subsequent Developer 3 tasks.
6. Tests/checks run with counts or outcomes, plus anything that could not be run.
7. Manual deployment steps that remain. Never imply that a committed migration is already applied remotely.

Use factual implementation language. Keep original plans in the task brief and use the handoff to prevent later agents from treating planned behavior as shipped behavior.

## Before committing Task 4

1. Review the Task 4 source and this handoff together.
2. Confirm `package-lock.json` includes the missing `@supabase/ssr` repair required by merged Task 3.
3. Review the Task 3 pgTAP correction in `auth_taste_persistence.test.sql` as a deliberate privacy-test fix.
4. Stage explicit Task 4 and documentation files; do not use `git add .` while unrelated changes are present.
5. Run `git diff --staged` and verify no secrets or `.env.local` data are included.
6. After merge, apply pending remote migrations with a dry run first, then update this document's state table with the real commit/PR and deployment result.
