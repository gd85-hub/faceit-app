# FACEIT CS2 Stats Compare

Small Next.js app for comparing lifetime CS2 statistics between two FACEIT
players. The project started as a technical spike: raw FACEIT Data API samples
live in `api-samples/`, and the app only uses fields that were verified from
those samples.

## FACEIT API key

Create a FACEIT Data API key in the FACEIT developer portal. FACEIT may require
MFA before you can create or view API keys.

The key is server-side only. Put it in `.env.local` and never prefix it with
`NEXT_PUBLIC_`.

```env
FACEIT_API_KEY=your_key_here
```

`.env.local` is ignored by git. `.env.example` intentionally contains an empty
value.

## Run locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful checks:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Dump API samples

Edit the nicknames at the top of `scripts/dump-samples.ts`, then run:

```bash
npm run dump
```

Successful raw responses are written to:

```text
api-samples/<nickname>/search.json
api-samples/<nickname>/player.json
api-samples/<nickname>/stats.json
```

`api-samples/` is ignored by git.

## Add a metric

Add one entry to `lib/metricDefinitions.ts`. Source metrics point at a FACEIT
`lifetime` key with `sourceKey`; derived metrics provide `compute(lifetime)`.

The normalizer and comparison engine read `metricDefinitions`, so a metric added
there flows into the API response and UI.

## Module structure

```text
app/                    Next.js App Router pages and route handlers
app/api/compare/        Public compare API with validation and rate limiting
components/             Server-rendered UI components
lib/faceitClient.ts     Low-level FACEIT Data API client
lib/playerService.ts    FACEIT search/profile/stats orchestration and cache use
lib/cache.ts            In-memory TTL caches
lib/compareUseCase.ts   Shared compare use case for page and API route
lib/comparisonEngine.ts Metric comparison and summary generation
lib/metricDefinitions.ts Metric catalog
lib/statsNormalizer.ts  Raw FACEIT stats to normalized metrics
types/                  Shared TypeScript types
scripts/                Local spike and verification scripts
```
