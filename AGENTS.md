<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# TasteDNA project handoff

Before changing this project, read [the LLM handoff](docs/team/LLM_HANDOFF.md), then the feature-specific documents it links. It records the medication, authentication, and friendship integration boundaries, verified tests, and remaining live-service blockers. `CLAUDE.md` imports this file, so the same entry point applies to Claude.

Keep the handoff current when changing these flows. Distinguish implemented code, automated verification, actual live verification, and external configuration still needed. Never put account passwords, auth tokens, or private environment values in documentation.
