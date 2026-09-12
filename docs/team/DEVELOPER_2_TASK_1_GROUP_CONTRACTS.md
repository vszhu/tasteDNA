# Developer 2 — Task 1: Shared Group Contracts and Golden Fixtures

## Changes

- Added the shared CMU group-dining domain contracts in `src/types/group.ts`.
- Defined venues, meal-specific preferences, dining sessions, session members, derived dish and restaurant utilities, group recommendations, and forward-compatible decision support types.
- Added typed golden fixtures for clear winners, a fairness-floor rejection, near ties, stale menus, and preference-driven outcomes.
- Reused solo TasteDNA types instead of changing `src/types/index.ts`.

## Verification

- Added fixture invariant tests.
- Confirmed the contracts were consumed by the later group-ranking and session work without duplicating domain types.

## Issues and follow-up

- The original misery-floor fixture later landed exactly at the inclusive floor boundary. Task 4 corrected that fixture and added an explicit all-fail compromise scenario.
- No shared solo-domain contracts, dependencies, or UI/API files were changed.
