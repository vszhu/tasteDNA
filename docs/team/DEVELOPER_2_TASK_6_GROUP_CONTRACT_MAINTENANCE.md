# Developer 2 — Task 6: Group Contract Maintenance

## Changes

- Aligned the `runnerUp` contract with the fairness-selection rule.
- `runnerUp` now means the next venue eligible to win: a venue clearing the misery floor when one exists, or the next best compromise when every venue fails it.
- Runner-up explanation facts now use the same eligible candidate, so UI gaps cannot describe a rejected venue as the next choice.

## Verification

- Added a regression where a high-average venue fails one member below the misery floor but appears above a valid alternative in raw group-score order.
- Confirmed the safe winner's runner-up is the valid alternative and its explanation gap is non-negative and reproducible.

## Issues and coordination

- Group results UI already renders the runner-up and confidence fields against this contract.
- `explanationFacts` are still not rendered by the results UI; that remains a separate Developer 1 follow-up and is intentionally out of scope for this maintenance change.
