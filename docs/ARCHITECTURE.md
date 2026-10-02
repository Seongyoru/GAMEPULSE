# GAMEPULSE — Architecture

## Principles

1. **Ingestion and serving are separate.** External API traffic scales with _source changes_, never with GAMEPULSE
   page views. Pages are served from PostgreSQL through static generation/ISR and CDN caching.
2. **PostgreSQL is the source of truth.** JSONB only for source-specific metadata, evidence excerpts and run diagnostics.
3. **Official sources first, provenance always.** Every record keeps its source URL, timestamps and parser version;
   weaker sources never overwrite stronger ones.
4. **AI is a transformation layer, never the source of truth.** Deterministic validation runs after every parser.
5. **No game-specific branches in generic code.** Games, sources and reset schedules are data/configuration.
6. **Runs without credentials or infrastructure.** Fixtures, mock transports, an in-memory store and PGlite keep
   development and tests working anywhere.

```
                ┌──────────────── apps/worker ────────────────┐
 official APIs  │ BullMQ scheduler ─► ingest job ─► pipeline  │
 official web ─►│  (or CLI: pnpm ingest / seed / ingest:manual)│
 manual JSON    └───────────────────────┬─────────────────────┘
 fixtures                               ▼
                                   PostgreSQL ◄── migrations (Drizzle)
                                        │
                ┌──────────────── apps/web ───────────────────┐
                │ Server Components (ISR, revalidate ≈ 5 min) │──► CDN ──► many users
                │ client: MY GAMES (localStorage), live clocks │
                └─────────────────────────────────────────────┘
```

## Repository layout

| Path                     | Responsibility                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`               | Next.js App Router site: TODAY, MY GAMES, game/patch/event/reward pages, calendar, SEO                                                                                    |
| `apps/worker`            | BullMQ worker + scheduler, operator CLI (`seed`, `ingest`, `ingest-manual`, `health`, `runs`, `prune`)                                                                    |
| `packages/domain`        | Pure, isomorphic domain: contracts (Zod), game registry, reset rules, time zones, status/reset/urgency engines, TODAY/snapshot/pulse/calendar builders, persistence ports |
| `packages/database`      | Drizzle schema + SQL migrations, `PostgresContentStore`, `InMemoryContentStore`, shared contract tests, PGlite test harness                                               |
| `packages/collectors`    | `SourceAdapter` contract, polite HTTP client (rate limits, backoff+jitter, robots.txt, conditional requests), fixture/manual adapters, adapter registry                   |
| `packages/parsers`       | `AIParser` abstraction, AI output contract, `MockParser`, `RuleBasedParser`, parse cache, HTML→text                                                                       |
| `packages/validators`    | Deterministic validation engine and publication/verification decisions                                                                                                    |
| `packages/ingestion`     | Pipeline orchestration, registry sync, fixture ingestion                                                                                                                  |
| `packages/observability` | Structured logger and Sentry-compatible error reporter                                                                                                                    |
| `packages/ui`            | Design-system React components (Tailwind)                                                                                                                                 |
| `packages/config`        | Server environment schema, data-source resolution, `.env` loading                                                                                                         |
| `fixtures/`              | Synthetic fixture feeds (`sources/*.json`) and manual-ingestion examples                                                                                                  |
| `docs/`                  | Product, architecture, data, sources, legal notes, runbook, research log                                                                                                  |

Internal packages export TypeScript sources directly (no build step); Next.js transpiles them, the worker is bundled
with esbuild, tests run them through Vitest.

## Ingestion pipeline

```
DISCOVER → FETCH → RAW DOCUMENT → PARSE/NORMALIZE → VALIDATE → DEDUPLICATE → PUBLISH
```

| Stage           | Where                           | Notes                                                                                                                                                                                                                              |
| --------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discover        | `SourceAdapter.discover()`      | lists documents (external ids/URLs)                                                                                                                                                                                                |
| Fetch           | `SourceAdapter.fetch()`         | `HttpClient`: identifying UA, per-host limits, `X-RateLimit-*`/`Retry-After`, exponential backoff with full jitter, ETag/Last-Modified, robots.txt for websites, anti-bot pages fail fast (never bypassed)                         |
| Raw document    | pipeline + store                | SHA-256 of the raw text; an unchanged hash skips parsing entirely                                                                                                                                                                  |
| Parse/normalize | `SourceAdapter.normalize()`     | deterministic parser, AI parser (cached by input hash + parser version), manual or fixture JSON → `NormalizedCandidate[]`; parse results stored with parser id/version                                                             |
| Validate        | `@gamepulse/validators`         | schema, chronology, ranges, URL allowlist, time-zone consistency, reward quantities, patch pairs, synthetic markers, redeem-code and AI evidence                                                                                   |
| Deduplicate     | pipeline                        | `(sourceId, sourceKey)` → own record; provenance lookup; `semanticKey` (game, kind, normalized title, start day) across sources with authority `OFFICIAL_API < OFFICIAL_FEED < OFFICIAL_WEB < MANUAL < TRUSTED_FALLBACK < FIXTURE` |
| Publish         | `ContentStore.publishContent()` | transactional upsert of the record and its typed detail; provenance row per source                                                                                                                                                 |

Guarantees:

- **Idempotent** — re-running with unchanged sources creates nothing; changed sources update records in place.
- **One run per adapter** — `ingestion_runs` has a partial unique index on `adapter_id WHERE status = 'RUNNING'`;
  stale runs are released after a timeout. BullMQ job ids are also per adapter.
- **Failure isolation** — a failing document or source is recorded (run status `PARTIAL`/`FAILED`, error report) and
  never deletes previously valid content.
- **Review never hides content** — a doubtful (`REVIEW`) update to a published record is held, the published version stays.

Every collector log line carries `adapter`, `game`, `runId`, `sourceUrl`, `duration`, `status`.

## Data model (summary)

See [DATA_MODEL.md](DATA_MODEL.md). `content_items` holds shared fields (type, title, slug, UTC start/end, original
source timing text and zone, provenance, confidence, verification, validation status, parser version); typed tables
(`patches`/`patch_changes`, `events`, `rewards`/`reward_items`, `redeem_codes`, `maintenances`, `banners`/`banner_featured`)
extend it. `content_sources` keeps every source that reported a record. `raw_documents`, `parse_results`,
`validation_results` and `ingestion_runs` make every published fact traceable.

Content ids are deterministic UUIDs of `(sourceId, sourceKey)`, so ids survive re-seeding and fixture-mode restarts.
Slugs are ASCII, assigned once, and never change.

## Time model

- All instants are stored in UTC (`timestamptz`); the source's original text and zone are preserved
  (`start_at_source`, `end_at_source`, `source_timezone`, `region`, `time_precision`).
- Zones: IANA names and fixed offsets (`UTC+8` for Genshin/Wuthering Waves Asia servers). Conversion is Intl-based,
  DST-aware (Temporal "compatible" disambiguation), and identical on server and client.
- Date-only facts (e.g. Riot's patch schedule) use `time_precision = DATE`; the UI never invents a time of day.
- **Status is computed, never stored**: `UPCOMING / LIVE / ENDING_SOON (< 48h) / ENDED / UNKNOWN`, reward states and
  maintenance states derive from start/end and "now".
- **Resets are recurrence rules** (`DAILY`, `WEEKLY`, `MONTHLY`, `CUSTOM_RRULE` subset) evaluated on the rule's local
  calendar; unsupported RRULE parts fail loudly.

## Web rendering strategy

- Public pages are Server Components rendered statically with ISR (`REVALIDATE_SECONDS`, default 300 s) and
  `generateStaticParams`; data access goes through the `ContentReadStore` port (PostgreSQL in production, in-memory
  fixtures in development when no `DATABASE_URL` exists — refused in production).
- MY GAMES lives in `localStorage` behind the `PreferencesStore` port. Personalization (filtering, ordering, dismissals)
  happens on the client from the statically rendered dataset; a tiny inline script applies the user's game selection
  as CSS state before first paint so personalized dashboards do not shift layout.
- Live countdowns subscribe to one shared ticker (`useSyncExternalStore`), so only the countdown text re-renders each
  second; status recomputation uses a minute ticker. Hydration uses the server's generation time as the snapshot.
- Locale-ready routing: Korean at the root today; future locales under prefixes (`/en`, `/ja`, `/zh-tw`) with
  `hreflang` alternates — canonical Korean URLs never change.

## Queue

BullMQ on Redis (`gamepulse-ingest`). MVP combines the stages in one job per adapter run (stage boundaries remain
explicit in code and logs). Job schedulers are registered only for adapters whose source `collectorStatus` is
`ENABLED` and whose credentials are present; fixture adapters refresh hourly in fixture mode.

## Security

- Secrets (API keys, AI keys, database URLs) live only in server environment variables; `@gamepulse/config/env` is
  never imported by client code; `.env` is git-ignored.
- External text is sanitized to plain text; fetched HTML is never rendered.
- Manual ingestion is CLI-only (requires database access); there is no public write endpoint.
- CI runs a dependency audit; pnpm enforces a minimum release age and blocks unapproved install scripts.

## Scaling and cost

Collectors → PostgreSQL → precomputed/cached pages → CDN → users. Pages are regenerated at most once per revalidation
window, per path; the database sees traffic proportional to pages × regenerations, not visitors. AI parsing runs only
for changed documents and is cached by input hash and parser version.
