# Medication-aware recommendations

## Run locally

The feature is available at `/medications`. It works without credentials. Use Node 22+ and the existing commands:

```sh
npm ci
npm run dev
```

Open **Example lab** to toggle example medicines and explore the interactive medicine → food term → dish map. Tap a medicine or food term to trace only its connected dishes. Tap a dish to inspect its warning, evidence, source, taste score, and review order. The lower cards offer taste-ranked alternatives within the no-listed-match group, with ingredient confirmation still required.

Use **Manage list** to add your exact medication and form. **My menu** connects the actual list to the current decoded menu and taste profile. **Use menu** adopts only the example dishes; it never copies example medicines or resets ratings. Example-lab selections are temporary and separate from the user's list. A restored menu opens in My menu automatically.

Decoded results now open in **Connection map** when medications are present. **Ranked list** retains feedback and sorting within review groups. The home, dashboard, decoder, and results entry cards all reflect the current menu's review counts. On mobile, connection cards replace the wide diagram; tapping a dish brings its inspector into view. All graph controls are native keyboard-operable buttons.

For a real pasted-text check, use **Decode → Paste text**:

```text
Pink Grapefruit Spritz — grapefruit juice and sparkling water 7
Garden Salad — tomato, cucumber and olive oil 12
Aged Cheddar Pasta — aged cheddar and pasta 17
Orange Cooler — orange juice and sparkling water 6
```

Live photo extraction still requires the repository's existing OpenAI configuration. If an unconfigured photo upload returns the sample fixture, medication screening is disabled for that result and the user is directed to paste text. Sample menus are labeled examples throughout.

## Architecture and privacy

- `src/lib/medications/catalog.ts`: versioned, curated food-interaction rules with drug-specific sources, formulations, section references, and source-check date.
- `src/lib/medications/check.ts`: pure matching, assessment, ranking, and sorting functions. No model, network call, or random score is involved in medication checking.
- `src/lib/medications/map.ts`: pure graph adapter. Paths retain their exact rule owner, matched term, menu item, and per-term evidence. Shared ingredient nodes never imply drug–drug relationships. Selecting a node highlights complete matching paths without traversing unrelated paths. Six dishes are paginated at a time; no menu items are dropped.
- `src/components/medications/interaction-explorer.tsx`: shared visual workspace for medication setup and decoded results, with attention filters, a linked inspector, and taste-ranked alternatives. The graph shows warnings first for inspection; the ranked list still shows the shortlist first. Neither changes taste scores. The decoder and empty-results sample buttons adopt this same menu without replacing existing ratings or medication selections. No external graph service or new runtime dependency is used.
- `src/components/providers/medication-provider.tsx`: independent health state. The list uses tab `sessionStorage`, keyed by anonymous/account scope, and is not written to `tastedna-v1`, Supabase, shared menus, group sessions, or AI requests. Account transitions mask the preceding account's list until the next scope has loaded. Storage failures are visible.
- The existing taste engine and database contracts are unchanged. Recommendations with no medication list retain their original score, explanation, and order. Medication selections are not fed into the taste-learning loop.
- **Clear list** removes the current scope's session-storage entry. Browser session restoration may retain session storage; do not promise automatic deletion merely because a tab/window was closed.

## Reference coverage

Sources were checked on **2026-09-12**. This is a prototype reference, not a comprehensive interaction service or a clinically validated medical device.

| Entry | Covered food guidance | Source |
| --- | --- | --- |
| Simvastatin oral tablets | Grapefruit juice receives a label warning. Whole grapefruit receives a distinct review finding. | [DailyMed §7.1](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4724dbb4-3613-4e6a-948f-a43d34f97f06), [MedlinePlus dietary instructions](https://medlineplus.gov/druginfo/meds/a692030.html) |
| Fexofenadine oral tablets | Fruit juice is an administration concern; the tablet label directs taking it with water. Whole fruit is not broadly prohibited. | [DailyMed Allegra Allergy warnings/directions](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f061d6b1-89f7-4d5f-ac59-9c73408517c1) |
| Linezolid oral tablets | Explicit examples of high-tyramine foods receive a portion/preparation review, not an unconditional prohibition. | [DailyMed patient counseling](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=90dd8c13-c428-4472-91e5-5b1fcdc4fce3) |
| Tacrolimus immediate-release oral capsules | Grapefruit and grapefruit juice receive a label warning. Ointment, other formulations, and ambiguous generic entries are not inferred. | [DailyMed capsule label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=46ac55cf-d85e-4c34-bb33-f49e078c4a03) |

Search offers explicit catalog selection. Only exact generic/brand aliases are canonicalized; combination medicines, unknown names, and doses embedded in free text remain unverified. Unsupported entries stay visible and prevent a medication shortlist, even if other medicines are covered.

## Assessment behavior

1. Read the extracted name, description, and ingredient fields. Never infer an interaction from cuisine, taste dimensions, embeddings, or an AI confidence score.
2. Apply phrase-boundary matching to normalized text. Inferred ingredients and qualified/negated mentions produce review findings rather than assertions of confirmed presence or absence.
3. Group results as **No listed match → Needs review → Label warning**. Price/menu-order sorting operates within those groups. Taste scores remain separate and unchanged.
4. Present every warning with its medication, matched phrase, source, explanation, and a concrete question to ask. Warning titles and matched terms remain visible outside the taste explanation accordion; each opens its evidence, source, and restaurant question.
5. Do not generate a medication shortlist when every dish needs review, the list includes unsupported medication, or an unread photo was replaced by sample data.

“No listed match” only describes the covered rules and available extracted text. Menus omit ingredients, and extraction can be wrong. Quantities, dosing schedules, all food aliases/languages, supplements, drug–drug interactions, allergies, other conditions, and comprehensive food safety are not assessed. Follow prescribed treatment and have medication questions reviewed by a pharmacist. A taste score is not a safety probability.

The group-results route currently previews fixture scenarios; it explicitly states that medication lists are not applied. Adding real group medication support requires a separate private, authenticated design.

## Verification

```sh
npm test
npm run lint
npm run build
```

Tests cover exact identity/formulation handling, warning evidence, qualified ingredients, multiple/unsupported medications, missing ingredients, unchanged taste scores, feedback and sorting safeguards, unread-photo fallback, session persistence, account isolation, and storage errors. Graph tests also cover shared-term isolation, rule ownership, mixed per-term evidence, alternative eligibility, filtering, pagination, stale selections, live-menu integration, and example-list isolation. Tests with the real TasteProvider and MedicationProvider verify decoder and empty-results sample loading, preservation of existing ratings, menu-only extraction payloads, feedback with warnings retained, and returning to taste-only results after clearing medications.

The completed integration run against main passed **231 tests**, ESLint, and the production build including TypeScript.

Browser verification covers medicine → ingredient → dish tracing, expandable sources, adopted example menus using only the actual medication list, ranked-list sorting, pasted text through the extraction API, and responsive mobile connection cards at 390 px and 320 px without horizontal overflow. The existing demo taste profile also updates scores in the map (rather than using static preview values). Live OpenAI photo extraction and deployed Supabase integration require credentials and are not exercised locally.

To add a medication, verify its formulation and food guidance against an authoritative source, preserve distinctions between avoidance, quantity, and administration guidance, add regression examples and ambiguous cases, and obtain clinical review before representing the reference as suitable for medical decision-making.
