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

## Phase 2 — Product shell ⏳

- ⏳ Design system (`@gamepulse/ui`): GameBadge, PulseCard, StatusChip, Countdown, RewardBadge, PatchChange,
  EventCard, ResetTimer, SourceBadge, GameFilter, Timeline, Calendar, EmptyState, Skeleton, AdSlot
- ⏳ Homepage, `/today`, MY GAMES (localStorage), games index/detail (+ patches, events, rewards, resets, calendar),
  content detail pages, `/calendar`
- ⏳ Analytics abstraction (no-op default), AdSlot placeholder mode
- ⏳ Playwright E2E suite on fixtures (no external websites)

**DoD:** a user can interact with all five games without any external API.

## Phase 3 — First live adapters ⏳

Engineering order: Lost Ark → League of Legends → MapleStory → Genshin Impact → Wuthering Waves.
Per adapter: research source · document terms · implement · fixture/mock tests · live smoke test · normalize · validate ·
deduplicate · monitor. Research and terms findings: [research log](research/), [DATA_SOURCES.md](DATA_SOURCES.md),
[LEGAL_NOTES.md](LEGAL_NOTES.md).

- ⏳ Lost Ark Open API adapter (notices, events) — built against the documented API, mock-tested; **held at
  PENDING_REVIEW** until Smilegate clarifies the "storing content" clause; needs `LOSTARK_API_KEY`.
- ⏳ League of Legends: Data Dragon structured stat diffs (keyless, official static data); lol-status-v4 maintenance
  adapter (needs a production `RIOT_API_KEY` + product registration). Patch-notes website: manual only (Riot ToS).
- ⏳ MapleStory NEXON Open API notice/event adapter — attribution required; **held at PENDING_REVIEW** (storage,
  30-day TTL and commercial-use terms need legal review); needs `NEXON_OPEN_API_KEY`.
- ⛔ Genshin Impact / Wuthering Waves website collection — publisher terms prohibit scraping/copying without written
  permission → manual ingestion until permission is granted.

## Phase 4 — AI parsing ⏳

- ⏳ ClaudeParser with strict structured output, evidence requirements, parse caching, cost controls
- ⏳ Apply to sources where it helps: event/maintenance notices, reward descriptions, patch notes

## Phase 5 — SEO / performance ⏳

- ⏳ Metadata, canonical URLs, sitemap, robots.txt, OpenGraph, JSON-LD, breadcrumbs, internal links
- ⏳ Static generation + ISR tuning, Core Web Vitals (LCP < 2.5 s, CLS < 0.1, INP < 200 ms), Lighthouse report

## Phase 6 — Production readiness ⏳

Source terms re-review · production API credentials · error monitoring · backups · rate limiting · privacy policy ·
terms page · copyright/source attribution · analytics · advertising policy review · human verification of reset rules.
