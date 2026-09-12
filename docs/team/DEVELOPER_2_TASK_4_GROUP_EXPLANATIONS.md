# Developer 2 — Task 4: Calculation-Backed Group Explanations

## Changes

- Added structured explanation facts derived only from ranking intermediates.
- Facts cover the winning fairness score, worst-member utility, runner-up gap, misery-floor rejections, all-fail compromise state, and each member's assigned best dish.
- Added venue, member, and dish identifiers to explanation facts so the UI can render them without parsing prose.
- Added a true all-fail golden fixture and explicit compromise expectations.

## Verification

- Added deterministic tests for a clear winner, a rejected venue, a tie, per-member dish evidence, and an all-fail compromise.
- Confirmed the fixture that names a failing venue now scores strictly below the inclusive 45-point floor.

## Issues and follow-up

- The previous `one-member-miss` fixture scored exactly 45, which correctly cleared the engine's `>= 45` boundary but contradicted the fixture's stated expectation. The fixture—not the engine boundary—was adjusted.
- The facts are ready for Developer 1 to display; Task 4 intentionally does not add React UI rendering.
