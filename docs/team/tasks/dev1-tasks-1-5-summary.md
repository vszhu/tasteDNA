# Developer 1 — Tasks 1–5 summary

Retroactive summary of the group-dining UI work merged into `main` so far. Written after the fact for anyone catching up; going forward each new task gets its own doc alongside its PR.

## Task 1 — CMU campus venue map and candidate picker (PR #5)

**What it does:** A Leaflet + OpenStreetMap view of real CMU dining venues (sourced from the public CMU Dining API), with a marker list synced to venue cards, and a 3–5 venue candidate picker for group sessions.

**Key files:**
- `src/components/map/campus-map.tsx` / `campus-map-inner.tsx` — the map itself, SSR-safe (`next/dynamic`, `ssr: false`, since Leaflet needs `window`).
- `src/components/map/selection.ts` — pure candidate-selection logic (3–5 cap, availability rules).
- `src/components/map/venue-card.tsx`, `fixtures.ts` — venue list card and demo fixture data.
- `src/app/venues/page.tsx` — the page tying map + list + picker together.

**Notable decision:** `src/types/group.ts` (the shared venue contract) didn't exist yet when this was built, so `venue-types.ts` was a temporary local stand-in, explicitly commented for deletion once the real contract landed.

## Task 2 — Magic-link sign-in and friends UI (PR #7)

**What it does:** A sign-in page (magic-link email flow) and a friends page (add-by-email, pending incoming/outgoing requests, accept/reject), with anti-enumeration messaging — the same neutral confirmation shows regardless of whether an email has an account.

**Key files:**
- `src/app/sign-in/page.tsx`, `src/app/friends/page.tsx`
- `src/components/providers/session-provider.tsx` — session state, kept separate from `taste-provider.tsx`
- `src/lib/auth/mock-adapter.ts`, `friend-rules.ts`, `types.ts` — mock auth/friends backend (no real API existed yet)

**Notable decision:** Built against a mock adapter since no backend existed; real Supabase auth later replaced the mock session provider without touching the friends UI.

## Task 3 — Group dining room and meal check-in (PR #14)

**What it does:** Session creation (pick candidate venues + invite friends) and a group room showing member readiness, candidate venues, and a temporary per-meal check-in (mood tags, protein/ingredient exclusions, price ceiling).

**Key files:**
- `src/app/sessions/new/page.tsx`, `src/app/sessions/[id]/page.tsx`
- `src/lib/session/meal-preferences.ts` — pure meal-preference state transitions
- `src/lib/session/mock-session-adapter.ts` — mock session backend

**Notable decision:** The temporary check-in is verifiably isolated from persistent TasteDNA — `meal-preferences.ts` and `mock-session-adapter.ts` never import `taste-provider.tsx` or `@/lib/taste` (enforced by a source-scan test), use their own localStorage key, and never call `rateDish`. Also retrofitted Task 1's map components onto the real `src/types/group.ts` contract once it landed, and wired `/venues` to the real `/api/venues` endpoint with a demo-data fallback.

## Task 4 — Group recommendation results UI (PR #17)

**What it does:** `GroupResultsView` — a presentation-only component rendering a computed `GroupRecommendation`: winner, runner-up gap, fairness stat tiles, per-member best dish with factor chips, other-venues-considered with misery-floor/staleness flags, decision confidence when present.

**Key files:**
- `src/components/group/group-results-view.tsx`, `result-helpers.ts`
- `src/app/sessions/[id]/results/page.tsx`

**Notable decision:** No reveal API exists, and computing a real recommendation needs other members' private TasteProfiles (which shouldn't be resolved client-side anyway), so the results page previews the real, already-merged `computeGroupRecommendation` engine against the 5 shared golden fixtures via a scenario picker — real computation, not fabricated output. Also fixed a broken `package-lock.json` missing the `@supabase/ssr` entry.

## Task 5 — Decision-aware targeted preference question (PR #18)

**What it does:** `PreferenceQuestionCard` — shown only when a `GroupRecommendation` carries a `preferenceQuestion` (hidden entirely for robust decisions), asking a targeted member a yes/no question and recomputing the recommendation live from their answer.

**Key files:**
- `src/components/group/preference-question.ts`, `preference-question-card.tsx`

**Notable decision:** The real engine doesn't return `preferenceQuestion` yet, so the results page attaches a mock one to the `preference-flip` fixture — the one scenario actually designed to flip on one member's answer — and proved the full loop with a real-engine regression test (answering "yes" flips the winner from `comfort-cafe` to `spice-route` via the real `computeGroupRecommendation`, not a hand-written fake result).

## Cross-cutting notes

- All five tasks were built against golden fixtures/mocks before their real backend counterparts existed, per the shared plan doc's "use mocks aggressively to stay unblocked" rule — each mock was scoped so swapping in a real API later needs no UI rewrite.
- A discrepancy in the `misery-floor` golden fixture (no fixture producing `compromiseRequired: true` against the real engine) was flagged after Task 4 and fixed by Developer 2 in PR #16 — verified working against `GroupResultsView` with no UI changes needed.
