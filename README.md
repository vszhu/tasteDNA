# TasteDNA

**Your palate, decoded.** TasteDNA learns a person's food preferences from a short set of ratings, turns those signals into a mathematical taste profile, and ranks every dish on a photographed or pasted restaurant menu for that specific person.

This repository is a hackathon-ready vertical slice: onboarding, a live TasteDNA profile, menu extraction, explainable 0–100 recommendations, and a feedback loop all work without sign-up or external services. Add OpenAI credentials to switch menu reading from the local fallback to multimodal extraction; apply the included Supabase migration when durable multi-user persistence is needed.

## Product flow

Medication-aware dining is now available under **Meds** (`/medications`). Add a medication list to prioritize review of covered food interactions before taste ranking. Every finding includes its source, and unsupported medicines remain visibly unverified. The list stays in this browser tab, separate from cloud taste data. See [medication coverage, demo, and limitations](docs/MEDICATION_CHECKS.md).

1. Rate 12 diverse, actively selected foods.
2. See cuisine, flavor, texture, and cooking-style preferences.
3. Upload a menu photo, take one on mobile, or paste menu text.
4. Get all dishes ranked with transparent match and mismatch factors.
5. React with “I’d order this” or “Not for me.”
6. Watch the profile and menu ranking update immediately.

## Architecture

TasteDNA is one strict TypeScript Next.js repository. Domain math is deliberately independent from React and external services.

```text
src/
├── app/                    # App Router pages and server-only API route
│   ├── api/menu/extract/   # Validated OpenAI/fallback extraction endpoint
│   ├── onboarding/         # Active-learning rating flow
│   ├── dashboard/          # TasteDNA profile and Recharts visualization
│   ├── decode/             # Image capture/upload and text ingestion
│   └── results/            # Ranking, explanations, feedback loop
├── components/
│   ├── layout/             # Responsive desktop and mobile navigation
│   ├── recommendation/     # Expandable result cards
│   ├── taste/              # Taste profile visualization
│   └── ui/                 # Small shadcn-style UI primitives
├── lib/
│   ├── db/                 # Optional Supabase client boundary
│   ├── embeddings/         # Swappable embedding providers and text normalization
│   ├── menu/               # Extraction schema, processing, fallback, sample data
│   ├── recommendation/     # Candidate scoring, explanation factors, ranking
│   └── taste/              # Seed foods, rating math, profiles, active learning
└── types/                  # Shared domain interfaces

supabase/migrations/        # PostgreSQL + pgvector schema and RLS
```

Anonymous ratings, extracted menu data, and feedback stay under the existing `tastedna-v1` localStorage key, so the complete solo flow works without an account or external service. With Supabase configured, a magic-link session instead loads and upserts that account's ratings and derived TasteDNA profile behind owner-only RLS. Signing in does not import anonymous data; an explicit import flow is deferred.

## Recommendation algorithm

Every dish has two complementary representations:

- A normalized text representation containing its name, cuisine, ingredients, major flavor/texture traits, proteins, bases, and cooking methods. Demo mode projects that text into a stable cached 64-dimensional vector. `EmbeddingProvider` makes the implementation swappable; an OpenAI embedding provider is included for a server-side persisted production pipeline.
- Twelve interpretable 0–1 attributes: sweet, salty, sour, bitter, umami, spicy, rich, fresh, crispy, creamy, chewy, and smoky, plus categorical cuisine, ingredient, protein, carbohydrate, and cooking-method data.

A rating is converted once through `ratingToWeight`:

```text
1 → -1.0   2 → -0.5   3 → 0   4 → +0.5   5 → +1.0
```

For rated dishes with embedding `eᵢ` and preference weight `wᵢ`:

```text
userVector = normalize(Σ wᵢeᵢ)
semantic = cosineSimilarity(userVector, candidateEmbedding)
structured = weightedCompatibility(attributePreferences, candidateAttributes)
rawScore = 0.70 × semantic + 0.30 × structured
Taste Match = round(clamp((rawScore + 1) × 50, 0, 100))
```

The 70/30 weights live in `src/lib/taste/constants.ts`. Scoring is deterministic for identical inputs. Explanation copy is built from the same strongest positive and negative contributions used in the score; it is not invented by a model. Cold start returns a neutral 50 until ratings exist.

Onboarding uses an understandable farthest-first selector. It repeatedly chooses the candidate least similar to foods already selected or rated, covering the taste space without presenting ten versions of the same dish. The extension point is `src/lib/taste/active-learning.ts`.

## Local setup

Requirements: Node.js 22 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment values are required for demo mode.

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp` if needed.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | No | Enables live server-side multimodal menu extraction. Never expose this with a `NEXT_PUBLIC_` prefix. |
| `OPENAI_MENU_MODEL` | No | Primary menu extraction model; defaults to `gpt-5.6-luna`. |
| `OPENAI_MENU_FALLBACK_MODEL` | No | Backup used only after an unusable primary result; defaults to `gpt-5.6-terra`. |
| `OPENAI_MENU_TIMEOUT_MS` | No | Timeout for each menu model attempt; defaults to 30 seconds. |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Browser Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No | Public Supabase publishable key; RLS still controls access. |
| `SUPABASE_URL` | No | Optional server-only Supabase URL; falls back to `NEXT_PUBLIC_SUPABASE_URL`. |
| `SUPABASE_SECRET_KEY` | No | Privileged key for server-side persistence jobs. Never expose it to the browser. |
| `CMU_DINING_API_URL` | No | CMU Dining feed URL used only by the manual sync route. |
| `CMU_DINING_TIMEOUT_MS` | No | Upstream sync timeout; defaults to 8 seconds. |
| `CMU_DINING_SYNC_SECRET` | No | Bearer secret protecting the manual CMU Dining sync route. |
| `TASTEDNA_DEMO_MODE` | No | Set to `true` to force fallback extraction even when OpenAI is configured. |

## OpenAI setup

1. Create an API key in the OpenAI dashboard.
2. Put `OPENAI_API_KEY=...` in `.env.local`; do not commit the file.
3. Optionally override the primary or fallback with image-capable models that support structured output.
4. Restart `npm run dev`.

OpenAI calls only occur behind `src/app/api/menu/extract/route.ts`. The primary request uses `gpt-5.6-luna` with no reasoning; `gpt-5.6-terra` runs only when the primary request fails or returns unusable structured data. Browser-supported images are resized to a maximum 1,920-pixel long edge and compressed before upload when useful. Uploaded images are validated by MIME type and limited to 8 MB after preprocessing. Model output is parsed through a strict Zod schema. Empty or malformed output becomes a concise UI error rather than a stack trace.

## Supabase setup

1. Create a Supabase project.
2. Apply the migrations (or run `supabase db push` with the CLI).
3. Add the project URL and publishable key to `.env.local` for browser access.
4. Add `SUPABASE_SECRET_KEY` only to the server environment when privileged persistence is needed.
5. In Supabase Authentication → URL Configuration, set the local Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL. Add the deployed callback URL before production use.
6. Restart the Next.js development server after changing environment variables, then use the sign-in page to request a magic link.

The implementation temporarily accepts the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` names as fallbacks, but new setups should use publishable and
secret keys.

Magic-link auth uses Supabase's PKCE-compatible server-side flow. The browser and request-scoped server clients share auth cookies, `proxy.ts` refreshes verified sessions, and `/auth/callback` exchanges the one-time code before redirecting to a token-free application URL. The database trigger creates `public.users` rows for new Auth users. Signed-in ratings retain the app's stable text dish IDs while an optional canonical dish UUID remains available for later shared data.

If you customize the Supabase email template to send a token hash, use a callback shaped like:

```text
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/friends
```

Both code-exchange and token-hash callbacks are supported. Never put `SUPABASE_SECRET_KEY` in a `NEXT_PUBLIC_` variable; ordinary auth and TasteDNA persistence use the publishable key plus RLS.

Authenticated menu extraction requests may include a `venueId` form field to publish the normalized result as that venue's shared menu. The route verifies the user and active venue before extraction, then calls a service-only database transaction. Identical normalized content reuses its existing menu version; changed content closes the previous current version and creates the next one. Raw uploaded images and base64 data are never written to the database. `GET /api/venues` attaches each venue's newest currently valid menu and reports it as `fresh` for 30 days after observation, otherwise `stale`.

Shared-menu persistence requires `SUPABASE_SECRET_KEY` on the server. Anonymous requests, and authenticated requests without `venueId`, continue through the existing one-off decoder without database writes.

The migration installs `pgcrypto` and `vector`, creates User, Dish, DishFeatures, Rating, TasteProfile, Menu, MenuItem, and Recommendation tables, adds indexes, and enables row-level security. Production OpenAI embeddings use 1,536-dimensional `text-embedding-3-small` vectors. The 46 starter foods live in typed source data so the demo bundle never needs a database round trip; a production sync can upsert them into `dishes` and `dish_features`.

## Demo mode

The application automatically uses demo-safe behavior when credentials are missing:

- “Try the instant demo” loads a seeded 12-rating profile and a seven-item sample menu.
- Menu images use sample extracted JSON if no OpenAI key is configured.
- Pasted menus use a deterministic line and keyword parser.
- Embeddings use a normalized, deterministic local projection.
- State persists in the browser.

Fallback responses are marked in the results UI. They are isolated in `src/lib/menu/sample.ts`, `src/lib/menu/process.ts`, and `src/lib/embeddings/deterministic.ts`, rather than mixed into production API code.

## Testing and quality checks

```bash
npm test
npm run lint
npm run build
```

The unit suite covers rating transformation, vector normalization, cosine similarity, taste-vector generation, attribute preferences, cold start, candidate scoring, and deterministic ranking. The integration test exercises ratings → TasteProfile → candidate menu → ranked recommendations.

## Deployment to Vercel

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. Import it in Vercel; the framework preset is detected automatically.
3. Add the desired environment values from `.env.example` in Project Settings.
4. Deploy. Vercel runs `npm run build` and serves the App Router API route as a server function.
5. Smoke-test one menu upload. If image requests time out, reduce image size before upload or use pasted text for the demo.

## Hackathon Demo Script

About 90 seconds:

1. **Rate foods (0:00–0:25).** Click “Discover My Taste” and quickly react to 12 recognizable foods. Point out that the set is deliberately diverse rather than random.
2. **Show generated TasteDNA (0:25–0:40).** Reveal the radar, top flavor signals, cuisines, cooking styles, and representative favorites. Say that these are directional signals, not fake precision.
3. **Upload a restaurant menu (0:40–0:52).** Open “Decode a menu,” choose a photo or the sample menu, and let the scanning state play.
4. **Show personalized rankings (0:52–1:05).** Highlight the top pick, 0–100 Taste Match, visual match tiers, and sorting controls.
5. **Inspect an explanation (1:05–1:16).** Expand a dish. Show the concrete positive/mismatch factors and the 70/30 score breakdown.
6. **Give feedback (1:16–1:23).** Choose “Not for me” on one item or “I’d order this” on another.
7. **Show the ranking change (1:23–1:30).** Point to the confirmation message and the immediately recalculated order, then return to the updated TasteDNA.

If venue Wi-Fi is unreliable, click “Try the instant demo” on the landing page. The story remains identical and makes no network call.

## Technical Story

TasteDNA combines six practical ideas in one explainable loop:

- **Semantic food embeddings** capture relationships that exact ingredient matching misses.
- **Structured interpretable preference features** make flavor, texture, cuisine, and cooking signals visible.
- **User preference-vector learning** turns positive and negative ratings into a normalized personal direction.
- **Cosine similarity** measures how closely a candidate dish follows that direction.
- **Personalized ranking** blends semantic similarity with structured compatibility into a deterministic 0–100 result.
- **Multimodal menu extraction** turns photos into validated dish records, while feedback-driven profile updates make the next ranking more personal.

The product is designed around honest uncertainty: low-confidence inferred fields are recorded, limited rating history is labeled as an early read, and recommendation explanations always map back to computed factors.

## Team ownership

Three developers can work without file contention:

- **Product/UI:** `src/app/` and `src/components/`
- **Taste and ranking:** `src/lib/taste/`, `src/lib/recommendation/`, and `src/lib/embeddings/`
- **Menu, API, and data:** `src/lib/menu/`, `src/app/api/`, `src/lib/db/`, and `supabase/`

Shared contracts live in `src/types/`. Keep external service code behind existing boundaries, and keep recommendation math out of React components.
