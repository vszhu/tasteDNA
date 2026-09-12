# Developer 2: Taste Engine and Ranking

Your job is to own the deterministic intelligence behind TasteDNA: active food selection, taste profiles, embeddings, menu-item scoring, explanations, and ranking quality.

Read [README.md](../../README.md), [the team workflow](./README.md), and the root `AGENTS.md` before asking an LLM to edit code. The README documents the current scoring formula and model boundaries.

## Files you own

You may edit these without extra coordination:

```text
src/lib/taste/
src/lib/recommendation/
src/lib/embeddings/
```

Keep tests beside the domain files, using names such as `scoring.test.ts` and `profile.test.ts`.

## Files you should not edit alone

- Pages and visual components belong to Developer 1.
- `src/app/api/`, `src/lib/menu/`, `src/lib/db/`, `src/components/providers/`, and `supabase/` belong to Developer 3.
- `src/types/index.ts`, dependency files, and configuration files are shared.

If the algorithm needs a new field, propose the exact type and example value in team chat. Prefer a small shared-contract PR before changing both producers and consumers.

## Good tasks for you

- Improve taste-vector calculation and confidence calibration.
- Improve active-learning diversity without making onboarding unpredictable.
- Tune semantic/structured score weights using documented examples.
- Make positive and negative explanations match the actual score factors.
- Add edge-case, regression, and integration tests.
- Evaluate ranking behavior on a fixed set of sample users and menus.
- Improve deterministic embeddings while preserving the provider interface.

Core domain code should stay independent from React, browser storage, Supabase, and HTTP requests. Scoring must be deterministic for identical inputs.

## Your first pull request

Start with a small PR named `codex/taste-confidence-tests`:

1. Document the expected profile confidence thresholds in tests.
2. Add edge cases for zero ratings, neutral ratings, and mixed positive/negative ratings.
3. Add a ranking regression case with a fixed user profile and at least three dishes.
4. Do not tune production weights unless a failing example proves why it is needed.

Suggested commit:

```powershell
git commit -m "test(taste): cover confidence and ranking edge cases"
```

## Prompt to give your LLM

```text
Work only on the TasteDNA taste-engine task described below. You may edit src/lib/taste, src/lib/recommendation, and src/lib/embeddings as defined in docs/team/DEVELOPER_2_TASTE_ENGINE.md. Do not edit React UI, API routes, menu extraction, persistence, shared types, dependencies, or configuration without asking me first. Keep calculations deterministic and explanations traceable to score factors. Add regression tests, run npm test, npm run lint, and npm run build, then show me git diff and list every changed file. Task: <describe one small task>
```

## Done means

- New or changed behavior has deterministic tests.
- Cold-start and neutral-rating behavior still work.
- Explanations are derived from score inputs, not invented text.
- No React, storage, database, or API concerns entered domain code.
- Any formula or weight change is explained in the PR description.
- Tests, lint, and build pass.

