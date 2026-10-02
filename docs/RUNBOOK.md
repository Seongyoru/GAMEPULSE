# GAMEPULSE — Runbook

## Daily operations

Health: `GET /api/health` → `{ status, dataSource, lastUpdatedAt, checkedAt }` (HTTP 503 when the store is
unreachable). Alert when it fails or when `lastUpdatedAt` stops moving for longer than the slowest schedule.

| Task                  | Command                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Recent ingestion runs | `pnpm runs --limit 50`                                                                                 |
| Source health         | `pnpm health:sources` (fixture/mock) · `pnpm health:sources --mode live`                               |
| Re-run one adapter    | `pnpm ingest --adapter <id> --mode live` (`--force` re-parses unchanged documents)                     |
| Manual fallback       | `pnpm ingest:manual <file.json>`                                                                       |
| Retention maintenance | `pnpm --filter @gamepulse/worker cli prune [--days 30]` — raw text + source TTLs (daily in the worker) |

## A collector is failing

1. `pnpm runs` — look for `FAILED`/`PARTIAL` runs and the stage (`discover`, `fetch`, `normalize`, `publish`).
2. Logs: filter by `adapter=<id>` and `runId=<id>`; every line has `sourceUrl`, `duration`, `status`.
3. Typical causes:
   - **HTTP 401/403** — credential missing/expired (Riot dev keys expire every 24 h). Update the secret; do not retry
     aggressively.
   - **`BlockedByProtectionError`** — the site serves an anti-bot challenge. Stop. Do not attempt to bypass; review the
     source's status and switch to manual ingestion.
   - **`RobotsDisallowedError`** — the path is disallowed. Do not collect it.
   - **429 / rate limit** — limits are honoured automatically; reduce schedule frequency if it persists.
   - **503 during maintenance** — expected for some APIs (Lost Ark, NEXON); runs retry later.
   - **Normalization warnings / empty discovery** — the source changed shape. Health checks should fail; update the
     parser with recorded fixtures before re-enabling.
4. Users keep seeing the last valid data — failures never delete content (stale-while-revalidate).
5. If the outage is long, publish the important facts via manual ingestion with official links.

## A record is wrong

- Official source corrected → the next run updates it in place (same id and slug).
- Our parser was wrong → fix the parser, bump its version, `pnpm ingest --adapter <id> --force`.
- Urgent manual correction → manual ingestion; note that official sources outrank manual input, so fix the parser too.
- Pending review items: `validation_results` with status `REVIEW` and `content_items.status = 'PENDING_REVIEW'`.

## AI parsing

- Enable with `AI_PARSER=claude` and `ANTHROPIC_API_KEY` (worker/CLI only). Without them everything runs on the
  deterministic parser.
- Structure an official notice that cannot be collected automatically:
  `pnpm ingest:text notice.txt --game genshin --url <official notice URL> --task EVENT --default-zone Asia/Seoul`
  (`--default-zone` only when the source prints unlabeled times in that zone). Check the report: facts whose
  evidence is missing are held as `PENDING_REVIEW`; AI facts are published as `UNVERIFIED`.
- `ParserError: … declined the document` — the request was refused by the model and its fallback; enter the facts
  with `pnpm ingest:manual` instead. `… above the …-character AI limit` — raise `AI_MAX_INPUT_CHARS` or split the
  notice; the parser never truncates.
- Re-parsing after a prompt change: bump `CLAUDE_PROMPT_VERSION` (new cache key) and re-run with `--force`.
- Usage per call (input/output/cache tokens) is stored with each parse result (`parse_results.usage`).

## Verifying reset rules

Reset rules (`packages/domain/src/games/reset-rules.ts`) are researched but `UNVERIFIED`. To verify one:

1. Confirm the schedule in game or in an official announcement for the target region.
2. Set `verification: 'MANUAL_VERIFIED'`, keep/adjust `sourceUrl`, update `notes` with the date and verifier.
3. `pnpm seed` (or run the worker) to sync; the UI drops the "verification pending" label.

## Database

- Migrations: `pnpm db:migrate` (idempotent). Generate after schema edits with `pnpm db:generate` and review the SQL.
- Backups: daily logical backups (`pg_dump`) plus point-in-time recovery from the managed provider; test restores
  quarterly.
- Run lock stuck (crashed worker): runs older than 30 min are released automatically on the next start; or
  `UPDATE ingestion_runs SET status='ABANDONED', finished_at=now() WHERE status='RUNNING' AND adapter_id='<id>';`

## Local services without Docker

`pnpm services:local` / `pnpm services:local:stop` (data in `.local/`). Connection strings match `.env.example`.

## Error monitoring

Errors go through the `ErrorReporter` abstraction (`@gamepulse/observability`). Without `SENTRY_DSN` they are logged.
To enable Sentry, install `@sentry/node` in the worker (and `@sentry/nextjs` in the web app), initialize it with
`SENTRY_DSN`, and construct the reporter with `createSentryErrorReporter(Sentry, logger)` in `apps/worker/src/runtime.ts`.
