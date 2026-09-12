# Developer 2 — Task 5: Decision Confidence and Targeted Meal Questions

## Changes

- Added deterministic confidence from the margin between viable group-ranking candidates.
- Added one optional unanswered meal-preference question for fragile decisions only.
- Simulates both yes (`desiredTags`) and no (`avoidedTags`) answers through the existing meal-utility and group-ranking pipeline, then selects the largest winner-flip or margin impact.
- Kept all scoring, simulation, and prompts pure; no React, storage, database, API, or model dependency was introduced.

## Verification

- Robust winner yields high confidence and no question.
- A spicy preference is selected when its answer can flip a fragile winner.
- Identical inputs produce the same question.
- The full suite, lint, TypeScript, and whitespace checks pass.

## Issues and follow-up

- `package-lock.json` is locally modified because it was out of sync with an existing `@supabase/ssr` dependency in `package.json`. It is intentionally excluded from this Developer 2 change and should be resolved by the platform/dependency owner in a separate commit.
- The UI/backend should map a yes answer to `desiredTags` and a no answer to `avoidedTags`, then call the existing group-ranking entry point again.
