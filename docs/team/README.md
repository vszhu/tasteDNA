# TasteDNA Team Guide

This folder splits TasteDNA into three areas that can be developed in parallel with minimal merge conflicts.

**LLMs: start with [LLM_HANDOFF.md](LLM_HANDOFF.md).** It links the feature guides, records merged medication/auth/friendship changes, and distinguishes passing local checks from blocked live verification.

| Developer | Area | Guide | Branch prefix |
| --- | --- | --- | --- |
| Developer 1 | Product and UI | [DEVELOPER_1_UI.md](./DEVELOPER_1_UI.md) | `codex/ui-` |
| Developer 2 | Taste engine and ranking | [DEVELOPER_2_TASTE_ENGINE.md](./DEVELOPER_2_TASTE_ENGINE.md) | `codex/taste-` |
| Developer 3 | Menu API, persistence, and infrastructure | [DEVELOPER_3_PLATFORM.md](./DEVELOPER_3_PLATFORM.md) | `codex/platform-` |

Developer 3's implemented Tasks 1–4, deviations, troubleshooting history, and downstream integration notes are tracked in [DEVELOPER_3_TASK_4_HANDOFF.md](./DEVELOPER_3_TASK_4_HANDOFF.md). Task 5's real friendship endpoints and Task 6 integration requirements are tracked in [DEVELOPER_3_TASK_5_HANDOFF.md](./DEVELOPER_3_TASK_5_HANDOFF.md). Read both before building social or group-session integrations.

## Rules everyone follows

1. Each developer uses a separate clone of the repository. Never run two LLM agents in the same folder.
2. Never work directly on `main`. Create one branch for one small task.
3. Stay inside the file ownership listed in your guide.
4. Ask in the team chat before editing a shared file.
5. Never commit `.env.local`, API keys, passwords, or service-role keys.
6. Review `git diff` yourself before committing LLM-generated code.
7. A pull request needs one teammate's approval and passing tests before it is merged.
8. Use **Squash and merge** on GitHub. Delete the remote branch after merging.

## One-time setup for each developer

Run these commands in PowerShell, replacing the URL only if the repository moves:

```powershell
git clone https://github.com/vszhu/tasteDNA.git
cd tasteDNA
npm install
Copy-Item .env.example .env.local
npm run dev
```

Each developer supplies their own local environment values. Do not send `.env.local` through GitHub, chat, or an LLM prompt.

## Workflow for every task

### 1. Start from current `main`

```powershell
git switch main
git pull origin main
git switch -c codex/area-short-task-name
```

Replace `area-short-task-name` with the prefix from your guide and a short description. Examples:

- `codex/ui-mobile-onboarding`
- `codex/taste-confidence-tests`
- `codex/platform-supabase-ratings`

Tell the LLM exactly which files it may edit, and ask it to show `git diff` when it finishes.

### 2. Check the work locally

```powershell
git status
git diff
npm test
npm run lint
npm run build
```

Also click through the changed feature in the browser. Tests passing does not replace a quick manual check.

### 3. Commit only your task

Stage explicit files instead of using `git add .`:

```powershell
git add path/to/file-one path/to/file-two
git diff --staged
git commit -m "feat(area): short description"
git push -u origin HEAD
```

Then open the GitHub link printed by `git push`, or open the repository's **Pull requests** tab and choose **New pull request**.

### 4. Write the pull request

Use this description:

```markdown
## What changed
- 

## Files intentionally changed
- 

## How I tested it
- [ ] npm test
- [ ] npm run lint
- [ ] npm run build
- [ ] Tested the changed flow in the browser

## Screenshots
Add before/after screenshots for UI changes.
```

The reviewer checks the code, runs or confirms the checks, and verifies that unrelated files were not changed. The author then uses **Squash and merge**.

## Staying current while a PR is open

If another PR merges first:

```powershell
git switch main
git pull origin main
git switch -
git merge main
```

If Git reports a conflict, stop and read the conflicting file with the developer who owns it. Keep the intended parts from both sides, remove the conflict markers, then run:

```powershell
git add path/to/resolved-file
git commit
git push
```

If you are unsure how to resolve it, return to the state before the merge with `git merge --abort` and ask the file owner for help. Do not use `git reset --hard`.

## Shared files

These files can affect everyone:

- `src/types/index.ts`
- `src/app/layout.tsx`
- `package.json` and `package-lock.json`
- `.env.example`
- `README.md`, `AGENTS.md`, and `CLAUDE.md`
- TypeScript, ESLint, Tailwind, Next.js, and Vitest configuration files

Only one open PR should modify a shared file at a time. Announce the change before starting. If a feature needs a new shared type, merge a small contracts-only PR first, then let the UI and platform work build on it.

## Suggested review rotation

- Developer 1 reviews Developer 2.
- Developer 2 reviews Developer 3.
- Developer 3 reviews Developer 1.
- Any PR touching shared files gets a second quick review from the affected area owner.
