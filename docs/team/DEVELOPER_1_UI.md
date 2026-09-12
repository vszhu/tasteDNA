# Developer 1: Product and UI

Your job is to make TasteDNA clear, fast, accessible, and polished without changing how its recommendation math or external services work.

Read [README.md](../../README.md), [the team workflow](./README.md), and the root `AGENTS.md` before asking an LLM to edit code.

## Files you own

You may edit these without extra coordination:

```text
src/app/page.tsx
src/app/onboarding/page.tsx
src/app/dashboard/page.tsx
src/app/decode/page.tsx
src/app/results/page.tsx
src/app/globals.css
src/components/brand/
src/components/layout/
src/components/recommendation/
src/components/taste/
src/components/ui/
public/
```

`src/app/layout.tsx` is shared because changing providers or metadata can affect the whole app. Announce changes to it first.

## Files you should not edit alone

- `src/components/providers/taste-provider.tsx` belongs to Developer 3.
- `src/lib/taste/`, `src/lib/recommendation/`, and `src/lib/embeddings/` belong to Developer 2.
- `src/app/api/`, `src/lib/menu/`, `src/lib/db/`, and `supabase/` belong to Developer 3.
- `src/types/index.ts` and dependency/configuration files are shared.

If the UI needs new data, describe the desired shape to the owner. Agree on a shared type before either side implements it.

## Good tasks for you

- Improve responsive layouts on phone, tablet, and desktop.
- Add accessible labels, keyboard navigation, focus states, and useful empty states.
- Polish onboarding progress, dashboard presentation, menu upload states, and result cards.
- Add component tests for important user interactions.
- Check visual consistency, overflow, loading states, and error messages.
- Capture screenshots and maintain the 90-second demo flow.

Do not calculate recommendation scores inside a React component. Display values returned by the taste engine.

## Your first pull request

Start with a small PR named `codex/ui-accessibility-polish`:

1. Test onboarding and menu decoding with only the keyboard.
2. Fix missing accessible labels or unclear focus states.
3. Check the pages at roughly 390 px and 1440 px widths.
4. Add or update tests for any interaction you change.
5. Include before/after screenshots in the PR.

Suggested commit:

```powershell
git commit -m "feat(ui): improve accessibility and responsive states"
```

## Prompt to give your LLM

```text
Work only on the TasteDNA Product/UI task described below. You may edit the owned UI paths in docs/team/DEVELOPER_1_UI.md. Do not edit API, persistence, recommendation math, embeddings, shared types, dependencies, or configuration without asking me first. Read AGENTS.md and relevant Next.js docs before coding. Keep the PR small, add appropriate tests, run npm test, npm run lint, and npm run build, then show me git diff and list every changed file. Task: <describe one small task>
```

## Done means

- The changed flow works with mouse and keyboard.
- Phone and desktop layouts were manually checked.
- Loading, empty, success, and failure states remain understandable.
- No recommendation or API behavior was duplicated in UI code.
- Tests, lint, and build pass.
- The PR changes only the files needed for this task.

