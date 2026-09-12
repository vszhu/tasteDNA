# Developer 3: Menu API, Persistence, and Infrastructure

Your job is to connect TasteDNA to outside services safely: OpenAI menu extraction, Supabase persistence, browser state, schema migrations, validation, and deployment configuration.

Read [README.md](../../README.md), [the team workflow](./README.md), and the root `AGENTS.md` before asking an LLM to edit code.

## Files you own

You may edit these without extra coordination:

```text
src/app/api/
src/lib/menu/
src/lib/db/
src/components/providers/
supabase/
```

You also coordinate environment-variable documentation and deployment changes, but `.env.example`, dependency files, and config files are shared and must be announced before editing.

## Files you should not edit alone

- Product pages and visual components belong to Developer 1.
- `src/lib/taste/`, `src/lib/recommendation/`, and `src/lib/embeddings/` belong to Developer 2.
- `src/types/index.ts`, `src/app/layout.tsx`, dependency files, and configuration files are shared.

When API or persistence work needs a contract change, agree on the type with both affected owners and merge that small contract first.

## Good tasks for you

- Make OpenAI menu extraction reliable, validated, observable, and safe.
- Keep API keys server-only and return useful sanitized errors.
- Implement authenticated Supabase persistence behind the provider boundary.
- Maintain migrations, indexes, row-level security, and data adapters.
- Preserve a dependable demo/fallback path for weak venue Wi-Fi.
- Add API and menu-processing tests for malformed and partial input.
- Configure deployment and CI after team agreement.

Never put `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable. Never log credentials or full sensitive request payloads.

## Your first pull request

Start with a small PR named `codex/platform-menu-api-tests`:

1. Add tests for valid pasted menu text, empty input, malformed model output, and fallback behavior.
2. Verify image type and size validation remains enforced.
3. Keep real OpenAI calls mocked in automated tests.
4. Confirm the no-key demo still works.

Build Supabase persistence in a later PR after authentication and the storage contract are agreed by the team.

Suggested commit:

```powershell
git commit -m "test(platform): cover menu extraction boundaries"
```

## Prompt to give your LLM

```text
Work only on the TasteDNA platform task described below. You may edit the API, menu, database, provider, and Supabase paths defined in docs/team/DEVELOPER_3_PLATFORM.md. Do not edit product UI, taste/recommendation math, embeddings, shared types, dependencies, or configuration without asking me first. Keep secrets server-only, validate all external input, preserve demo fallback behavior, and mock paid external calls in tests. Read AGENTS.md and relevant Next.js docs before coding. Run npm test, npm run lint, and npm run build, then show me git diff and list every changed file. Task: <describe one small task>
```

## Done means

- External input and model output are validated.
- Failures return safe, understandable errors without leaking secrets.
- The app still works without OpenAI or Supabase credentials.
- Database changes include a migration and appropriate row-level security.
- Paid services are mocked in automated tests.
- Tests, lint, and build pass.
- The PR changes only the files needed for this task.

