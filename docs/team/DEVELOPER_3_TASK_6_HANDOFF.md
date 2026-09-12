# Developer 3 Platform Handoff: Task 6 Group Session and Recommendation API

Last updated: 2026-09-12

Branch: `codex/platform-group-session-api`

Base: latest `origin/main` at `aa0a30d`

State: implemented and verified locally; not committed, pushed, merged, or deployed

Read this with [the Tasks 1–4 handoff](./DEVELOPER_3_TASK_4_HANDOFF.md), [the Task 5 friendship handoff](./DEVELOPER_3_TASK_5_HANDOFF.md), and `src/types/group.ts`.

## Outcome

Task 6 adds one authenticated backend path from persisted collaboration state to Developer 2's real pure group-ranking engine.

| Method | Route | Authorization and behavior |
| --- | --- | --- |
| `POST` | `/api/group-sessions` | Creates a session atomically for the signed-in creator, with 3–5 active candidates and accepted-friend invitees |
| `GET` | `/api/group-sessions/[sessionId]` | Returns the RLS-visible session, roster summaries, caller's own meal state, and latest derived result |
| `POST` | `/api/group-sessions/[sessionId]/invitations` | Creator invites one accepted friend |
| `PATCH` | `/api/group-sessions/[sessionId]/invitations` | Invitee sends `{ "action": "accept" }` or `{ "action": "decline" }` |
| `PUT` | `/api/group-sessions/[sessionId]/meal-preferences` | Accepted member creates or updates only their own validated temporary meal state |
| `PUT` | `/api/group-sessions/[sessionId]/candidates` | Creator atomically replaces the 3–5 active candidate venues |
| `POST` | `/api/group-sessions/[sessionId]/recommendation` | Creator loads private inputs server-side, computes once, and persists/deduplicates a versioned result |
| `GET` | `/api/group-sessions/[sessionId]/recommendation` | Accepted member reads the latest derived snapshot |

All routes verify the Supabase user from cookies. Client-provided user IDs are never used as the caller identity.

## Implementation

`src/lib/group-sessions/` contains:

- `schemas.ts`: strict request validation for names, UUID sets, invitation actions, and `MealPreferenceState`. Contradictory desired/avoided tags, duplicate IDs, invalid prices, and oversized lists are rejected before storage access.
- `types.ts`: repository, engine-adapter, API detail, roster summary, and versioned result contracts.
- `repository.ts`: database vocabulary mapping, authenticated RLS reads/writes, server-only compute input assembly, newest-menu loading, and snapshot persistence.
- `compute.ts`: deterministic canonical SHA-256 input hashing and the single call to `computeGroupRecommendation(...)`.
- `server-context.ts`: verified cookie user plus separated user/admin Supabase clients.
- `http.ts`: stable route responses and sanitized error/status mapping.

The production engine version is `fair-group-v1.0.0`. The engine remains injected at the orchestration boundary so tests can prove it is called exactly once with deterministic inputs.

## Database migration

Migration `202609120004_group_session_api.sql` adds three service-only transactions:

- `create_group_session(...)` validates the creator, accepted friendships, active unique candidates, and inserts session/members/candidates atomically.
- `replace_group_session_candidates(...)` validates creator ownership and atomically replaces the candidate set.
- `persist_group_recommendation(...)` validates creator ownership, deduplicates by session/version/input hash, and marks the session `decided` in the same transaction.

Execution is revoked from `public`, `anon`, and `authenticated`, and granted only to `service_role`. Browser code cannot bypass the routes to create sessions or write derived snapshots with these functions. Existing Task 1 grants and RLS remain the authorization boundary for ordinary participant reads and user-owned writes.

## Compute pipeline and privacy

The creator compute route:

1. Confirms the caller can read the session and is its creator.
2. Batch-loads accepted members, their persisted `TasteProfile` JSON, and their temporary meal state with the server-only client.
3. Loads active candidate venues and the newest valid shared menu version for each candidate.
4. Builds one `GroupRankingInput` and calls Developer 2's `computeGroupRecommendation(...)` once.
5. Hashes canonicalized session/member/profile/menu identity with SHA-256.
6. Stores only the derived `GroupRecommendation` snapshot, algorithm version, hash, computing user, and timestamp.

Raw ratings are never loaded by this route. Private profile and meal-state objects exist only in server memory during computation. Session responses expose:

- public member display names;
- membership/readiness status;
- whether each member has checked in;
- only the caller's own `MealPreferenceState`;
- derived recommendation utilities/results.

Another member's raw profile or meal-state JSON is never serialized into a response or result snapshot.

The newer medication feature is deliberately not part of group computation. Medication selections remain tab-local private data and are not uploaded, persisted in group tables, or shared with the group engine.

## Contract mappings and intentional differences

The original database predates Developer 2's shared vocabulary. The repository maps it explicitly:

| Database | Shared/API |
| --- | --- |
| session `planning` | `open` |
| session `decided` | `revealed` |
| session `closed` | `cancelled` |
| member `accepted` without meal state | `joined` |
| member `accepted` with meal state | `responded` |
| member `invited` / `declined` | unchanged |

`SessionMemberSummary` intentionally omits the shared contract's `mealPreferenceState`; the response has `hasMealPreferences` instead. `ownMealPreferenceState` is a separate top-level field visible only to its owner. This deviation is required by the Task 1 privacy model.

Candidate rows have no position column in the existing schema. Repository reads sort candidate UUIDs for deterministic recomputation rather than claiming to preserve the UI selection order. If product design later needs manual candidate priority, add an explicit position column and migration.

Only the creator may trigger compute/recompute. This prevents every accepted member from repeatedly spending server resources or racing the session's derived result. Accepted members can read the snapshot.

All accepted members require a saved TasteDNA profile. At least one candidate must have a usable shared menu. Missing inputs return `409` with a safe actionable message instead of producing fixture results or silently invoking ingestion/sync.

## UI integration status

The Task 6 backend is real, but Developer 1's existing pages still use `mockSessionAdapter` and fixture results:

- `src/app/sessions/new/page.tsx`
- `src/app/sessions/[id]/page.tsx`
- `src/app/sessions/[id]/results/page.tsx`

Do not treat the mock UI as evidence that the API failed. A later UI integration should replace those adapter calls with the routes above and remove the fixture result preview. The friendship UI fix exists separately in commit `5f563ac` on `feat/dev2-task6`; it was not duplicated into this branch.

## Verification

- Focused Task 6 unit tests: 3 files, 14 tests passed.
- Full application suite: 48 files, 245 tests passed.
- Database suite: 5 pgTAP files, 96 tests passed, including 13 new Task 6 transaction/authorization tests.
- ESLint: passed.
- TypeScript (`npx tsc --noEmit`): passed.
- Production build: passed and emitted all six Task 6 route paths.
- No live OpenAI, CMU, or hosted Supabase mutation was used by automated tests.

Database validation used an isolated temporary PostgreSQL 17 Supabase stack on ports 55420–55422. It was stopped and removed after testing. The user's preserved PostgreSQL 15 local volume remains untouched; the ordinary stack still cannot start under the current CLI's PostgreSQL 17.6 image.

## Deployment steps remaining

1. Review and commit only the Task 6 files on `codex/platform-group-session-api`; no commit or push was performed here.
2. Merge the friendship UI fix separately if desired; it is not a Task 6 migration dependency.
3. Before deploying application code, run:

   ```powershell
   npx supabase@latest db push --dry-run
   ```

4. Confirm the pending list is expected. The hosted project may still need both `202609120003_friendship_api.sql` and `202609120004_group_session_api.sql`; migrations must apply in order.
5. Run `npx supabase@latest db push`, then deploy/redeploy with `SUPABASE_SECRET_KEY` configured only in the server environment.
6. Test with two accounts and real shared menus: friendship acceptance, session creation, invitation acceptance/decline, isolated meal check-ins, creator candidate replacement, compute, result visibility, and outsider denial.

Never infer hosted migration state from this repository or handoff. The Task 6 migration was tested locally but was not pushed remotely.
