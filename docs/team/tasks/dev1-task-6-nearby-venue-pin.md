# Developer 1 — Task 6: Nearby user-created venue pin

## What it does

A small authenticated flow for adding a venue that's off the CMU dining list: name it, describe where it is in free text, and drop a pin by tapping the existing campus map. No geocoding, search, autocomplete, or routing — just a name, a label, and a manually-placed point.

- `/venues/new` — the form: venue name, address/description label, and a map in "pick mode."
- Validates that name, label, and a picked point are all present before allowing submit.
- Warns when the new pin looks like an existing venue (exact name match, or within 75 meters of one) and lets the user create it anyway.
- On success, redirects to `/venues`, where the new pin now appears in the map and list.

## Key files

- `src/lib/nearby-venues/duplicate-check.ts` — pure duplicate detection: exact case-insensitive name match, or a haversine-distance check within `DUPLICATE_DISTANCE_METERS` (75m). No geocoding involved, just coordinate math.
- `src/lib/nearby-venues/mock-adapter.ts` — mock, localStorage-backed "create a nearby venue" backend (no real API exists yet), returning `{ok:true, venue}`, `{ok:false, reason:"duplicate", matches}`, or `{ok:false, reason:"invalid"}`.
- `src/components/map/campus-map-inner.tsx` / `campus-map.tsx` — extended (additive, optional props only) with a `pickedLocation` / `onPickLocation` pair: when set, clicking the map drops/moves a pin instead of selecting an existing venue. Existing callers (`/venues`, `/sessions/new`) are unaffected since these props are optional.
- `src/components/map/use-venues.ts` — now also merges in any nearby venues a user has created, so a new pin actually shows up in the picker everywhere venues are listed.
- `src/app/venues/new/page.tsx` — the form page, gated behind sign-in like the other authenticated flows.

## Notable decisions

- No real backend exists for creating venues, so this follows the same mock-adapter pattern as friends/sessions (Tasks 2–3): a small typed adapter, isolated localStorage key, swappable for a real API later without UI changes.
- A user-created venue always has `menuItems: []` and `menuFreshness: "unknown"` — honest about the fact that it has no digitized menu, so it shows up on the map/list but isn't selectable as a group-session candidate (consistent with how any other menu-less venue behaves).
- Duplicate detection is a warning, not a hard block — "Create it anyway" lets the user proceed, since a false-positive match (two genuinely different nearby spots) shouldn't be a dead end.
- Verified end-to-end in-browser (pin placement, validation errors, duplicate warning triggering against a real venue name, "create anyway," and the new venue appearing back on `/venues`) by temporarily bypassing the sign-in gate for local QA only — reverted completely before committing, since this sandbox has no real Supabase credentials to sign in with for real.

## Also fixed

Found and fixed a build break on `main`: Developer 2's misery-floor fix (PR #16) added a new golden fixture (`all-fail-compromise`) to `GROUP_GOLDEN_FIXTURES`, which broke the `SCENARIO_LABELS` lookup in `src/app/sessions/[id]/results/page.tsx` (Task 4/5's results page) — TypeScript now requires every fixture id to have a label. Added `"all-fail-compromise": "Best of a bad bunch"` to fix it.
