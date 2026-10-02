# GAMEPULSE — Decision log

Architecture decisions, newest last. Each entry: context → decision → consequences.

## D-001 · pnpm 12 with supply-chain defaults (2026-10-02)

pnpm 12.8.1 was the current release. It rejects unknown `pnpm-workspace.yaml` keys, blocks dependency install scripts
unless approved (`allowBuilds`), and enforces a minimum release age. **Decision:** keep all defaults; approve only
`esbuild`, `sharp`, `unrs-resolver`; deny `msgpackr-extract` (optional native accelerator — BullMQ falls back to JS);
pin `globals` below a too-new release instead of excluding it from the policy. CI installs pnpm with
`npm install -g pnpm@12.8.1` (Corepack 0.34 cannot run pnpm 12's package layout).

## D-002 · TypeScript 6.0, not 7.0 (2026-10-02)

TypeScript 7.0 (native compiler) was current, but `typescript-eslint` 8.71 — required by `eslint-config-next` —
supports `typescript <6.1.0`. **Decision:** pin `~6.0.3`; revisit when the lint ecosystem supports 7.x.

## D-003 · ESLint 9, not 10 (2026-10-02)

`eslint-plugin-react`, `eslint-plugin-import` and `eslint-plugin-jsx-a11y` (bundled by `eslint-config-next`) do not
declare ESLint 10 support. **Decision:** ESLint 9.39 (maintenance line). Next's config is scoped to React files;
type-aware `typescript-eslint` rules apply to all TypeScript.

## D-004 · Internal packages ship TypeScript sources (2026-10-02)

Packages export `src/*.ts` directly. Next.js transpiles them (`transpilePackages`), Vitest runs them, and the worker
is bundled with esbuild (workspace code bundled, third-party packages external and declared as direct worker
dependencies because pnpm does not hoist). No per-package build step or stale `dist` folders.

## D-005 · `@gamepulse/ingestion` as its own package (2026-10-02)

The spec suggests the pipeline inside the worker. The same pipeline is used by the worker, the CLI, the web app's
fixture mode and integration tests, so it lives in `packages/ingestion` and depends only on ports (stores) — never on a
concrete database.

## D-006 · Store ports with two implementations and one contract (2026-10-02)

`IngestionStore`/`ContentReadStore` are interfaces in `@gamepulse/domain`. `PostgresContentStore` (production) and
`InMemoryContentStore` (fixture mode, unit tests) must pass the same contract suite, which also runs against PGlite
and a real PostgreSQL server in CI.

## D-007 · PGlite as the integration-test fallback (2026-10-02)

Docker is unavailable in the cloud development sandbox. **Decision:** integration tests use `TEST_DATABASE_URL`
(throwaway database per suite) when set, otherwise embedded PGlite (PostgreSQL compiled to WASM) running the same SQL
migrations. Production architecture is unchanged (PostgreSQL + Redis + Docker Compose).

## D-008 · Deterministic content ids (2026-10-02)

Content ids are UUID-shaped SHA-256 digests of `(sourceId, sourceKey)`. Ids survive re-seeding and fixture-mode
restarts (keeping localStorage dismissals valid) and are identical across store implementations.

## D-009 · Run lock in PostgreSQL (2026-10-02)

A partial unique index on `ingestion_runs(adapter_id) WHERE status = 'RUNNING'` makes "one run per adapter" atomic and
driver-agnostic; stale runs are marked `ABANDONED` after a timeout. BullMQ job ids are also per adapter.

## D-010 · Relative fixture times resolved at fetch (2026-10-02)

Fixture files use expressions (`@-2d`, `@+3d/10:00` in the game's server zone) resolved against an anchor when a
document is _fetched_. Same anchor → same raw hash → idempotent; new anchor → the fixture "source" has published fresh
data → records update in place. Default anchor: the current hour; tests pin it.

## D-011 · Time-based status is computed, never stored (2026-10-02)

Statuses derive from start/end and "now" on server and client; no cron updates rows. Maintenance without an end time
reads `UNKNOWN` after 12 h instead of "in progress forever".

## D-012 · Source authority and provenance (2026-10-02)

Authority: `OFFICIAL_API < OFFICIAL_FEED < OFFICIAL_WEB < MANUAL < TRUSTED_FALLBACK < FIXTURE`. A stronger source
supersedes a weaker record in place (id and slug kept); a weaker or equal source only adds a `SUPPORTING` provenance
row. Provenance rows are never deleted.

## D-013 · Review never unpublishes (2026-10-02)

If a new candidate needs `REVIEW` but the record is already `PUBLISHED`, the update is held and the published version
stays ("do not delete previously valid content").

## D-014 · Reset rules live in code, unverified until a human checks (2026-10-02)

Reset schedules are configuration (`packages/domain/src/games/reset-rules.ts`) researched from official guides and
notices, each citing its source, all `UNVERIFIED`. The UI shows the verification state. Flipping a rule to
`MANUAL_VERIFIED` requires a person to confirm it in game.

## D-015 · Date-only precision (2026-10-02)

Some official facts only give a date (Riot's patch schedule is published as Pacific-Time dates; Korean deployment
time is not announced). `timing.precision = DATE` stores the start of that date in the stated zone and the UI shows
the date only — no invented time of day.

## D-016 · Synthetic data safety (2026-10-02)

Fixture content must be `isSynthetic` (validator rejects otherwise) and synthetic redeem codes must start with
`GPTEST-`. Fixtures are refused in production unless `GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION=true` (previews), and the
UI labels synthetic content. Fixture links point to the publisher's news pages, never to fabricated article URLs.

## D-017 · Source collection status from terms review (2026-10-02)

Based on the [2026-10-02 research](research/):

- **Riot patch-notes website:** Riot ToS prohibits bots/scraping of Riot services (including websites) → no web
  collector; patch notes via manual ingestion. **Data Dragon** (official static data) and **lol-status-v4** (API key)
  are acceptable API routes.
- **Lost Ark Open API:** terms say storing content violates them, contradicting the usage guide's caching advice →
  adapter may be built, collection held at `PENDING_REVIEW` until written clarification.
- **NEXON Open API (MapleStory):** attribution required; storage/commercial-use limits (English terms: 30-day TTL, no
  ads with the data) → `PENDING_REVIEW` until legal review; `dataRetentionDays` models the TTL.
- **Genshin Impact / Wuthering Waves websites:** no documented API/feed; terms prohibit scraping/copying without
  written permission → collectors `DISABLED`; manual ingestion until permission.

## D-018 · Korean notices vs server time (2026-10-02)

Korean Genshin/Wuthering Waves notices usually state KST (sometimes unlabeled, sometimes mislabeled "server time")
while English notices state UTC+8 server time. Parsers must map explicit labels only and never guess an unlabeled zone
unless the source's policy declares a default; original strings are always preserved for audit.
