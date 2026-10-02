# GAMEPULSE — Roadmap

Status legend: ✅ done · 🚧 in progress · ⏳ planned · ⛔ blocked (external dependency)

## Phase 1 — Foundation ✅

- ✅ pnpm monorepo (apps/web, apps/worker, packages/*), TypeScript strict, ESLint (type-aware), Prettier, Vitest projects
- ✅ Docker Compose (PostgreSQL 18, Redis 8) and a Docker-less `scripts/local-services.sh`
- ✅ Drizzle schema + SQL migrations for every core entity
- ✅ Domain contracts (Zod), game registry (5 games), reset-rule registry (researched, unverified)
- ✅ Time zones (IANA + fixed offsets, DST), status engine, RRULE-subset reset engine, urgency ranking, TODAY builder
- ✅ SourceAdapter framework: polite HTTP client, robots.txt, rate limits, backoff with jitter
- ✅ Fixture feeds for all five games; manual ingestion CLI
- ✅ Ingestion pipeline with idempotency, run locks, provenance, authority-based dedupe, failure isolation
- ✅ Validation engine; AIParser abstraction with MockParser and RuleBasedParser
- ✅ PostgreSQL and in-memory stores passing one contract suite (in-memory, PGlite, PostgreSQL)
- ✅ BullMQ worker + scheduler, operator CLI, structured logging, Sentry-compatible reporter
- ✅ CI: format, lint, typecheck, unit, integration (PostgreSQL/Redis services), build, dependency audit

**DoD:** `pnpm install` ✅ · services start ✅ · `pnpm db:migrate` ✅ · fixtures ingest ✅ · tests pass ✅ · CI defined ✅

## Phase 2 — Product shell ✅

- ✅ Design system (`@gamepulse/ui`): GameBadge, PulseCard (event/item card), StatusChip, Countdown, RewardBadge,
  PatchChange, ResetTimer, SourceBadge, GameFilter, Timeline, Calendar, EmptyState, Skeleton, AdSlot
- ✅ Homepage, `/today`, MY GAMES (`/my-games`, localStorage behind `PreferencesStore`, pre-paint boot script),
  games index, game overview + patches/events/rewards/resets/calendar tabs (feature-aware), content detail pages
  (`/patches|events|rewards|notices/[slug]`, canonical-family redirects), unified `/calendar`, 404/error pages
- ✅ Static generation + ISR (5 min) on every public page; live statuses/countdowns recomputed on the client
- ✅ Analytics abstraction (no-op default, console, GA4) with one delegated listener; AdSlot off/placeholder
- ✅ Component tests (jsdom) and Playwright E2E on fixtures, desktop + mobile (no external websites): homepage,
  MY GAMES selection/persistence, TODAY filtering and dismissals, game detail tabs, content detail, calendar filters

**DoD:** a user can interact with all five games without any external API ✅ (`pnpm test:e2e`: 26 passing)

## Phase 3 — First live adapters ✅ (collection enabled where terms allow)

Engineering order: Lost Ark → League of Legends → MapleStory → Genshin Impact → Wuthering Waves.
Per adapter: research source · document terms · implement · fixture/mock tests · live smoke test · normalize · validate ·
deduplicate · monitor. Research and terms findings: [research log](research/), [DATA_SOURCES.md](DATA_SOURCES.md),
[LEGAL_NOTES.md](LEGAL_NOTES.md).

- ✅ Shared live-adapter infrastructure: recorded-response transport for mock mode (`fixtures/http/`), synthetic twin
  sources for mock data, source-time normalization, JSON document fetching, health reports, reference entries for
  sources that are deliberately not collected.
- ✅ Lost Ark Open API adapter `lostark-openapi` (events, reward claim deadlines, maintenance and general notices) —
  mock-tested end to end; **held at PENDING_REVIEW** until Smilegate clarifies the "storing content" clause; needs
  `LOSTARK_API_KEY`.
- ✅ League of Legends `lol-ddragon` — keyless official static data, **ENABLED**; live smoke test on 2026-10-02
  produced the 16.18.1 → 16.19.1 diff (9 structured changes).
- ✅ League of Legends `lol-status` (lol-status-v4 maintenance/incidents) — mock-tested; **held at PENDING_REVIEW**
  until product registration and a production `RIOT_API_KEY`. Patch-notes website: manual only (Riot ToS).
- ✅ MapleStory `maplestory-openapi` (NEXON event/update/general notices) — mock-tested; **held at PENDING_REVIEW**
  (storage, 30-day TTL, commercial use and attribution display need legal review); needs `NEXON_OPEN_API_KEY`.
- ⛔ Genshin Impact / Wuthering Waves website collection — publisher terms prohibit scraping/copying without written
  permission → `DISABLED` reference sources; manual ingestion until permission is granted.
- ⏳ Before enabling a held source: verify the first live responses against the mock fixtures, enforce
  `dataRetentionDays` for TTL-bound sources, show source attribution on every card that displays its data.

## Phase 4 — AI parsing ✅

- ✅ `ClaudeParser` (official Anthropic SDK, structured outputs from a Zod schema, default model `claude-opus-5-5`,
  effort `medium`, server-side refusal fallback): the model transcribes verbatim facts with evidence; zone
  resolution and UTC conversion are deterministic; `stop_reason` is checked before anything is parsed
- ✅ Store-backed parse cache (`parse_results`, keyed by input hash + parser version), input-size limit (no silent
  truncation), lazy parser construction so non-AI commands need no AI configuration
- ✅ `pnpm ingest:text` — operators structure the text of an official notice (Genshin Impact, Wuthering Waves and any
  other source without automated collection); AI facts are published only with evidence found in the text and as
  `UNVERIFIED`
- ✅ Tests: pipeline tests use `MockParser`; `ClaudeParser` unit tests drive the real SDK against a stub `fetch`
  (no network, no credentials, no paid requests)
- ⏳ Collector use once a source is enabled: e.g. NEXON notice detail bodies → maintenance windows (`usesParser`)

## Phase 5 — SEO / performance ✅

- ✅ Metadata, canonical URLs, sitemap, robots.txt, OpenGraph/Twitter cards, JSON-LD, breadcrumbs, internal links
  (built with Phase 2; see [SEO.md](SEO.md))
- ✅ Indexing policy: synthetic content `noindex` + excluded from the sitemap; sample-data deployments disallow crawling
- ✅ Core Web Vitals budgets in the Playwright suite (LCP < 2.5 s, CLS < 0.1 on five page types, desktop and mobile,
  plus personalized TODAY); measured LCP 0.1–0.2 s and CLS ≤ 0.004 on the production build (local)
- ✅ Browser bundle budget: Zod removed from client bundles (−90 KB gzipped per page; 189–230 KB JS) and guarded by
  an ESLint rule
- ⏳ Lighthouse/field data (CrUX, INP) on the first real deployment; ISR tuning with real data volumes

## Phase 6 — Production readiness ⏳

Source terms re-review · production API credentials · error monitoring · backups · rate limiting · privacy policy ·
terms page · copyright/source attribution · analytics · advertising policy review · human verification of reset rules.
