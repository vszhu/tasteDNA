# Developer 2 — Task 2: Context-Aware Dish Utility

## Changes

- Added the pure `scoreDishForMeal()` layer in `src/lib/recommendation/meal-utility.ts`.
- Blends persistent TasteDNA scoring at 75% with temporary meal-context alignment at 25%.
- Supports spicy, light, comforting, filling, cheap, and quick signals when menu data supports them.
- Applies ingredient, protein, and price exclusions without mutating a persistent `TasteProfile`.
- Returns the base score, context adjustment, bounded final utility, exclusion reason, and structured score factors.

## Verification

- Added tests for persistent-only behavior, supported meal signals, exclusions, cold start, and score bounds.
- Later group-ranking tests continue to use this function as their single dish-utility source.

## Issues and follow-up

- `quick` is only evaluated when a cooking method explicitly indicates quick or fast preparation; no menu details are guessed.
- Missing price or trait data yields no corresponding context signal rather than fabricated precision.
