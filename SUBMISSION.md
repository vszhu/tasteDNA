# TasteDNA

## Project Summary

TasteDNA turns "what should I eat?" into solvable math. Rate a dozen foods and it builds a real preference vector (semantic embeddings + 12 flavor/texture attributes), then scores any photographed or pasted restaurant menu against it — every score ships with the explainable factors behind it, not a black box.

Beyond solo recommendations, TasteDNA tackles group dining fairly: friends join a session, set temporary meal preferences, and a fairness-aware engine (65% group average + 35% worst-member protection, with a misery-floor safeguard) picks a venue everyone can live with, asking a targeted follow-up question only when the decision is genuinely close. It's grounded in real Carnegie Mellon dining data with a live campus map, and extends into food safety with a medication-interaction checker that cross-references a sourced drug-food catalog against your decoded menu.

Three developers, one shared domain contract, zero merge conflicts, and one consistent idea throughout: make food decisions personal, fair, and explainable.

## Why TasteDNA Fits the Food Track

TasteDNA treats "food" as three interconnected problems most food apps solve separately, if at all: personal taste, group decision-making, and food safety.

At its core is a genuine recommendation engine — cosine similarity over learned preference vectors plus structured flavor compatibility — applied to real, decoded restaurant menus, not star ratings or cuisine tags. That's food discovery done rigorously.

It then extends into the social reality of eating: deciding where to eat is almost always a group activity, and TasteDNA is one of the few systems that models that as an actual fairness problem, with a documented objective and an honest compromise when no perfect answer exists, rather than "most votes wins."

It's grounded in a real dining ecosystem — live Carnegie Mellon dining venues, persisted shared menus, student-added off-campus spots — not a synthetic dataset built for a demo.

And it takes food seriously enough to address food *safety*: medication-food interactions are a real, under-served problem, and TasteDNA surfaces sourced, cited warnings at the exact moment they matter — while ordering — without ever overstating its authority.

Every score, ranking, and warning in this project traces back to a deterministic, tested formula in the source code. That's what makes it a food project through and through: not a UI wrapped around an API call, but real modeling of what makes food personal, social, and sometimes medically constrained.

## How Did You Use AI to Build Your Project?

Heavily, and deliberately in parallel. All three of us built with AI coding agents (Claude Code and OpenAI Codex) as our primary implementation tool, split across strict file ownership — product/UI, taste and ranking math, and platform/persistence — so three agents could work simultaneously with almost no merge conflicts. The one shared dependency was a versioned domain contract (`src/types/group.ts`); everything else was designed to be built against typed mocks and golden fixtures first, then swapped for real backends without touching the consuming code.

Each of us drove our agent directly: writing the task, letting it explore the existing codebase before changing anything, reviewing every diff, and requiring it to run the test suite, linter, and production build before calling anything done. Agents wrote the pure domain logic (fairness ranking, medication rule matching, taste-vector math), the UI, the Supabase schema and RLS policies, and the majority of our test suite. We treated the agents as fast, literal-minded engineers — we still made every product and architecture decision, and caught and redirected several agent mistakes (a misery-floor edge case, a broken build from a fixture change) through review, not blind trust.

## How Did You Integrate AI Into Your Project?

TasteDNA uses OpenAI's API for multimodal menu extraction: a photographed or pasted menu is sent to a vision-capable model (with an automatic fallback model on failure) and parsed into strict, schema-validated structured dishes — name, ingredients, cuisine, flavor and cooking attributes — via structured output, not freeform text we'd have to guess-parse. If no API key is configured, a deterministic local extractor takes over so the whole demo works offline.

We deliberately did *not* use AI for the two places where trust and reproducibility mattered most: the recommendation/fairness scoring is pure cosine-similarity and weighted-average math over the extracted data, and the medication-interaction checker is exact, phrase-matched pattern lookup against a curated, source-cited catalog — zero model calls inside the checker, fully deterministic and unit-tested. Upstream extraction can still be wrong, and the limited catalog does not establish medical safety. AI extracts the data; transparent math decides what it means. An OpenAI embeddings provider is also implemented and swappable in for the current deterministic offline embeddings when a production deployment wants richer semantic vectors.
