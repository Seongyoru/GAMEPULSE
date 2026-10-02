# GAMEPULSE — Deployment

GAMEPULSE runs as two processes sharing one PostgreSQL database and one Redis instance:

```
              ┌────────────── CDN (cache static/ISR pages) ──────────────┐
users ──────► │  apps/web  (next start, Node 22)  ── read ──► PostgreSQL │
              └──────────────────────────────────────────────────────────┘
                 apps/worker (node dist/main.js) ── write ──► PostgreSQL
                         └── BullMQ queue ──► Redis
```

- **apps/web** only reads published content (`ContentReadStore`). Pages are static/ISR (`revalidate = 300`), so the
  database load is proportional to pages × regenerations, not visitors.
- **apps/worker** runs ingestion (BullMQ job schedulers) and is the only writer. It can scale to zero between runs
  when hosted as a scheduled job (`node dist/cli.js ingest --all --mode live` from cron) instead of a long-running
  worker.

## Requirements

| Component  | Version                          | Notes                                                        |
| ---------- | -------------------------------- | ------------------------------------------------------------ |
| Node.js    | 22.12+                           | `pnpm@12.8.1` for installs                                   |
| PostgreSQL | 16+ (CI and Compose use 18)      | Managed service with daily backups + point-in-time recovery  |
| Redis      | 7+ (CI and Compose use 8)        | Only the worker uses it; `noeviction` policy for BullMQ      |
| CDN        | any (Vercel, CloudFront, Fastly) | Respect `Cache-Control` from Next.js; no custom rules needed |

## Environment

All variables are documented in [`.env.example`](../.env.example). Production essentials:

| Variable                                                           | web | worker | Notes                                                            |
| ------------------------------------------------------------------ | --- | ------ | ---------------------------------------------------------------- |
| `NODE_ENV=production`                                              | ✓   | ✓      | Enables production safety checks                                 |
| `DATABASE_URL`                                                     | ✓   | ✓      | Web may use a read-only role / read replica                      |
| `GAMEPULSE_SITE_URL`                                               | ✓   |        | Canonical origin, e.g. `https://<your-domain>` (never hardcoded) |
| `REDIS_URL`                                                        |     | ✓      |                                                                  |
| `COLLECTOR_MODE=live`                                              |     | ✓      | `fixture`/`mock` are refused in production                       |
| `COLLECTOR_CONTACT`                                                |     | ✓      | URL or e-mail in the collector User-Agent                        |
| `RIOT_API_KEY`, `LOSTARK_API_KEY`, `NEXON_OPEN_API_KEY`            |     | ✓      | Only for adapters whose source is `ENABLED` (see DATA_SOURCES)   |
| `AI_PARSER`, `ANTHROPIC_API_KEY`                                   |     | ✓      | Optional; server-side only                                       |
| `SENTRY_DSN`                                                       | ✓   | ✓      | Optional                                                         |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | ✓   |        | Build-time (inlined into the client bundle)                      |
| `NEXT_PUBLIC_ADS_MODE`                                             | ✓   |        | `off` until an ad provider and policy review exist               |

Secrets are server-side only. Nothing but `NEXT_PUBLIC_*` reaches the browser, and no secret uses that prefix.

**Synthetic data never reaches production.** The web app refuses to serve fixtures, the worker refuses `fixture`/`mock`
collection, and `pnpm seed` refuses fixture ingestion when `NODE_ENV=production` — unless
`GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION=true`, which is meant only for preview deployments (those pages are
`noindex`, `robots.txt` disallows crawling and every item is labelled as sample data).

## Release procedure

```bash
pnpm install --frozen-lockfile
pnpm db:migrate                 # forward-only SQL migrations (idempotent)
pnpm seed --registry-only       # sync games, sources and reset rules (no fixtures)
pnpm build                      # web (.next) + bundled worker (apps/worker/dist)
```

1. **Migrate before building.** `next build` prerenders public pages from the database (read-only queries), so the
   build environment needs `DATABASE_URL` and the schema must already be current.
2. Start the web app: `pnpm --filter @gamepulse/web start` (or `next start` from `apps/web`) behind the CDN.
3. Start the worker: `node apps/worker/dist/main.js` (long-running BullMQ worker + schedulers), or schedule
   `node apps/worker/dist/cli.js ingest --all --mode live` with cron.
4. Smoke test: `/api/health` returns `ok`; `/`, `/today`, `/games/<slug>`, `/sitemap.xml`, `/robots.txt`;
   `pnpm runs` shows recent runs; `pnpm health:sources --mode live` passes for enabled sources.
5. Point the uptime monitor at `/api/health`. The worker schedules a daily maintenance job (raw-text pruning and
   source TTLs) next to the ingestion schedules; with `INGEST_SCHEDULE_ENABLED=false`, run
   `node apps/worker/dist/cli.js prune` from cron instead.

Rollback: redeploy the previous build. Migrations are additive; destructive schema changes ship in two releases
(expand, then contract).

## Preview deployments

Previews without a database build and serve fixtures:

```bash
GAMEPULSE_DATA_SOURCE=fixtures GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION=true pnpm build
GAMEPULSE_DATA_SOURCE=fixtures GAMEPULSE_ALLOW_FIXTURES_IN_PRODUCTION=true pnpm start
```

CI uses the same configuration for the build check and the Playwright suite.

## Containers

`docker-compose.yml` provides PostgreSQL and Redis for development. For production images, build once and run two
containers from it (`next start` for web, `node apps/worker/dist/main.js` for the worker). The web build needs
database access at build time (see above); if the image build cannot reach the database, build the image in the
release pipeline step that runs migrations.

## Operations

- Logs are JSON in production (`LOG_FORMAT=json`), one line per event with `adapter`, `runId`, `sourceUrl`,
  `durationMs` and `status`.
- Errors go through the `ErrorReporter` abstraction (Sentry when `SENTRY_DSN` is configured; see RUNBOOK).
- Raw document text is pruned after `RAW_TEXT_RETENTION_DAYS` (`pnpm cli prune`); hashes and metadata are kept.
- Day-to-day procedures: [RUNBOOK.md](RUNBOOK.md). Pre-launch legal checklist: [LEGAL_NOTES.md](LEGAL_NOTES.md).
