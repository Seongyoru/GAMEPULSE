# GAMEPULSE

**All Your Games. One Pulse.** — a personal dashboard that tells players what changed, what to claim and what resets
or expires **today** across League of Legends, Lost Ark, MapleStory, Genshin Impact and Wuthering Waves.

GAMEPULSE is built on official sources first, keeps provenance for every fact, and runs fully offline on synthetic
fixtures — no API key or external service is needed to develop or test it.

## Quick start

Requirements: **Node.js 22.12+** and **pnpm 12** (`npm install -g pnpm@12.8.1`). Docker is optional.

```bash
pnpm install
cp .env.example .env

# PostgreSQL + Redis — pick one:
docker compose up -d            # Docker
pnpm services:local             # no Docker: native postgres/redis binaries (scripts/local-services.sh)

pnpm db:migrate                 # apply SQL migrations
pnpm seed                       # sync games/sources/reset rules + ingest fixture feeds through the pipeline
pnpm dev                        # web app on http://localhost:3000
```

**No database at all?** Leave `DATABASE_URL` empty and run `pnpm dev`: the web app ingests the fixture feeds into an
in-memory store at startup (development only; refused in production).

## Common commands

| Command                                                             | What it does                                                         |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:worker`                                      | Web app / ingestion worker (BullMQ, needs Redis)                     |
| `pnpm seed [--games lol,genshin]` · `pnpm seed --registry-only`     | Registry sync + fixture ingestion (idempotent) · registry only       |
| `pnpm ingest --adapter <id> [--mode fixture\|mock\|live] [--force]` | Run one adapter through the pipeline                                 |
| `pnpm ingest:manual <file.json>`                                    | Administrator fallback ingestion (see `fixtures/manual/`)            |
| `pnpm health:sources [--mode live]`                                 | Source health checks                                                 |
| `pnpm runs`                                                         | Recent ingestion runs                                                |
| `pnpm lint` · `pnpm typecheck` · `pnpm format:check`                | Static checks                                                        |
| `pnpm test:unit` · `pnpm test:integration` · `pnpm test:e2e`        | Unit + component · integration (PostgreSQL or PGlite) · Playwright   |
| `pnpm build`                                                        | Production builds (web + bundled worker)                             |
| `pnpm db:generate`                                                  | Generate a migration after editing `packages/database/src/schema.ts` |

Every CLI command accepts `--dry-run` (in-memory store) and `--json`.

## Repository

```
apps/web            Next.js site (TODAY, MY GAMES, game pages, calendar, SEO)
apps/worker         BullMQ worker, scheduler and operator CLI
packages/domain     contracts, game registry, time/status/reset/urgency engines (pure, isomorphic)
packages/database   Drizzle schema + migrations, PostgreSQL and in-memory stores
packages/collectors SourceAdapter framework, polite HTTP client, fixture/manual adapters
packages/parsers    AIParser abstraction (Mock, RuleBased, Claude), AI output contract
packages/validators deterministic validation engine
packages/ingestion  discover → fetch → raw → parse → validate → dedupe → publish
packages/observability  structured logging, Sentry-compatible error reporting
packages/ui         design-system components
packages/config     environment schema
fixtures/           synthetic feeds for all five games + manual-ingestion examples
docs/               product, architecture, data model, sources, legal notes, runbook
```

## Documentation

[Product](docs/PRODUCT.md) · [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md) ·
[Data sources](docs/DATA_SOURCES.md) · [Collectors](docs/COLLECTORS.md) · [AI pipeline](docs/AI_PIPELINE.md) ·
[SEO](docs/SEO.md) · [Deployment](docs/DEPLOYMENT.md) · [Runbook](docs/RUNBOOK.md) · [Legal notes](docs/LEGAL_NOTES.md) ·
[Roadmap](docs/ROADMAP.md) · [Decisions](docs/DECISIONS.md) · [Research log](docs/research/)

## Data and trust

- Official API → official feed → official website → administrator input → trusted fallback. Weaker sources never
  overwrite stronger ones; every record links to its original source.
- Synthetic fixture content is always labelled; synthetic redeem codes start with `GPTEST-` and cannot be used in game.
- Collectors run only where a source's terms allow automated collection (see [DATA_SOURCES.md](docs/DATA_SOURCES.md)).

Game names and trademarks belong to their respective owners. GAMEPULSE is not endorsed by or affiliated with
Riot Games, Smilegate, NEXON, HoYoverse or Kuro Games.
