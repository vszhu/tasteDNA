# Group menu ingredients and review recovery

Read [LLM_HANDOFF.md](LLM_HANDOFF.md), [MEDICATION_CHECKS.md](../MEDICATION_CHECKS.md), and the group-session handoff before editing this flow.

## Reproduced problem

The live `Group lunch` session had accepted members and saved medication settings, but computing returned “Every candidate needs a medication or ingredient review.” The September 11 campus dataset contained 614 entries across 37 venues; its import generated estimated ingredients and marked descriptions uncertain. The live follow-up confirmed that populated ingredient arrays were still estimates, not published evidence. Every nonempty opted-in medication list therefore held these dishes for review. This was separate from the earlier account-storage and invitation-link repairs.

An additional bug engaged medication venue filtering for an explicitly saved empty list, potentially blaming meal-preference exclusions on medication checks. Empty lists now preserve the original taste-only behavior while still counting as connected settings.

## Ingredient evidence

Shared-menu reads enrich existing imported rows; no database rewrite, account changes, or secrets are needed. The source gate requires the original `cmu-dining-dataset-v2` provider, September 11 dataset date, and `dishDetailsInferredFromNames` metadata. Exact dataset IDs and dish names prevent cross-venue guesses. Published components additionally require the matching source URL. Published components replace original importer estimates even when those arrays are nonempty. New user-uploaded menus remain authoritative and are not overwritten.

- `src/lib/menu/cmu-ingredient-details.ts` adds factual components from the linked CMU menus. These are menu descriptions, not complete recipes or allergen declarations. Sauces, preparation, subingredients, and current availability still require confirmation.
- Recipe estimates are explicitly identified as estimates. Their `ingredients-estimated` marker remains in `unknownFields`, so medication screening cannot promote them to a checked shortlist. An estimate can identify a question to review; it cannot establish absence of an interaction.
- `Dish.ingredientSource` carries the published/estimated label and, for published facts, the source URL and check date. Candidate menus and assigned dishes display this distinction.
- Persisted menu/item/dish IDs, prices, menu order, taste vectors, ratings, friendships, and medication lists are preserved. Ingredient fields can affect ingredient-based meal exclusions, but taste vectors are not rebuilt.
- Entries such as rotating specials and unspecified build-your-own categories remain explicitly unavailable when no particular recipe can be identified. Do not fill these with arbitrary ingredients or claim all 614 entries are verified restaurant recipes.

Coverage at this revision: **23 published-component records, 451 labeled recipe estimates, and 140 unavailable/variable entries** across all 614 catalog entries. The source coverage test audits every entry; unavailable categories do not become fictional ingredient lists.

The initial published source is [CMU’s Au Bon Pain menu](https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/113/abp-online-menu.pdf), checked September 12, 2026. Additional published records cover six K-Station items and five Capital Grains bowls; their exact CMU URLs, source age, and limitations are recorded in the source modules. Forbes’ current PDF does not match the older imported signature names, so those are not represented as current published recipes.

## Minimal group fix and privacy

The existing group flow is retained. Review and warning dishes remain excluded; if none remain, the existing error explains that estimated ingredients still need confirmation. No new group workflow or API contract is introduced. Explicitly empty saved lists no longer trigger medication-based venue filtering.

`GROUP_RECOMMENDATION_VERSION` is `fair-group-v1.2.1-published-ingredients`; the server invalidates older snapshots even if account revisions match, because a read-time ingredient update does not fire a database invalidation trigger.

## Verification

Focused tests cover public ingredient provenance, unchanged persisted identities/taste vectors, source gating, unsupported medicines, empty-list behavior, ingredient labels, and old-result invalidation. The full application suite passed 395 tests in 63 files. ESLint, TypeScript, and production build passed. Hosted verification follows deployment and must be recorded separately.

No medication rules or dose guidance were changed. Do not disable checks, clear anyone’s list, or fabricate restaurant ingredients to force a successful recommendation.

Production follow-up: the first deployment preserved populated importer estimates, so the original group remained blocked. The follow-up removes that extra guard only inside the exact original-source gate. The regression uses the observed nonempty BLT estimate with an uncertain-description marker. Final live outcome is recorded in the release PR after deployment.
