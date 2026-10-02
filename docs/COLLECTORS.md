# GAMEPULSE — Collectors

Collectors are `SourceAdapter`s (`packages/collectors/src/types.ts`). They **never write to the database**: they
discover, fetch and normalize; the ingestion pipeline validates, deduplicates and publishes.

```ts
interface SourceAdapter {
  id: string;
  gameId: string;
  source: SourceDefinition;
  mode: 'fixture' | 'mock' | 'live';
  discover(): Promise<DiscoveredResource[]>;
  fetch(resource, previous?: { etag; lastModified }): Promise<FetchedDocument>;
  normalize(document): Promise<NormalizeResult>; // candidates + parser {id, version, kind} + documentText
  healthCheck(): Promise<AdapterHealth>;
}
```

## Modes

| Mode      | Purpose                                                                                 | Network |
| --------- | --------------------------------------------------------------------------------------- | ------- |
| `fixture` | Synthetic GAMEPULSE feed (`fixtures/sources/<game>.json`) — rich content for every type | none    |
| `mock`    | A real source adapter against recorded/synthetic HTTP responses (`MockTransport`)       | none    |
| `live`    | A real source adapter against the real source (credentials when required)               | yes     |

The same adapter code runs in `mock` and `live`; only the transport differs. In `mock` mode the context's transport
replays `fixtures/http/<adapter>/routes.json` (documented response shapes or official data excerpts), and the adapter
reports a **twin source** `<source>-mock` of type `FIXTURE`: mock records are synthetic, labelled, refused in
production, and can never supersede or be confused with records from the real official source.

## Live adapters

| Adapter              | Resources                                                                   | Identity                           | Notes                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lol-ddragon`        | `realms/kr.json`, `api/versions.json`, `championFull.json` + `item.json` ×2 | `ddragon:<version>`                | One PATCH per Data Dragon version with numeric diffs vs the previous version (base stats, spell cooldown/cost/range, Rift item price/stats). 304 ⇒ skip. |
| `lol-status`         | `lol/status/v4/platform-data` (KR)                                          | `maintenance:<id>`/`incident:<id>` | No structured window ⇒ times null; latest Korean update line (≤ 200 chars) as summary; `info` incidents skipped.                                         |
| `lostark-openapi`    | `/news/events`, `/news/notices?type=점검`, `/news/notices?type=공지`        | `event:<id>` / `notice:<id>`       | `RewardDate` ⇒ REWARD (claim deadline) linked to its event; maintenance window unknown ⇒ null; thumbnails dropped.                                       |
| `maplestory-openapi` | `/maplestory/v1/notice-event`, `/notice-update`, `/notice`                  | `event:<notice_id>` …              | Event windows with explicit `+09:00`; attribution "Data based on NEXON Open API" travels with the source.                                                |

Shared helpers: `fetchJsonDocument` (polite GET with conditional validators), `parseSourceDateTime` (explicit offsets
honoured; offset-less values only in the zone declared by the source policy; `9999-…` sentinels ⇒ null),
`healthReport`, `isAllowedHost` (item links outside the source's allowed hosts are dropped with a warning).

## Adding a source

1. Research the source (official? documented? terms? robots? rate limits?) and record it in
   `docs/research/<date>-<topic>.md` and [DATA_SOURCES.md](DATA_SOURCES.md).
2. Define its `SourceDefinition` (type, allowed hosts, authentication, rate limit, content types, **collector status**,
   terms URL/review date, robots policy, attribution, retention).
3. Implement the adapter with `context.http` (never `fetch` directly) and a parser:
   - prefer deterministic parsing of structured data;
   - use `RuleBasedParser` for official date formats;
   - use an `AIParser` only where text understanding adds clear value (output is evidence-checked).
4. Add recorded responses under `fixtures/http/<adapter>/` and mock-mode tests (no network in tests).
5. Register the `AdapterDefinition` in `packages/collectors/src/registry.ts` and add its id to the game's `adapters`.
6. Implement `healthCheck()` with semantic checks (reachable · expected marker present · parser returns content ·
   latest timestamp plausible). Shape changes must fail loudly — never publish empty data silently.
7. Only after the terms review set `collectorStatus: 'ENABLED'` — the worker schedules nothing else.

## Fixture files

```jsonc
{
  "gameId": "genshin",
  "timezone": "UTC+8", // zone for "@+Nd/HH:mm" and auto-generated source timing text
  "locale": "ko-KR",
  "region": "asia",
  "documents": [
    {
      "externalId": "genshin-fx-events",
      "url": "https://genshin.hoyoverse.com/ko/news", // publisher news page — never a fabricated article URL
      "publishedAt": "@-9d/11:00",
      "items": [
        {
          "key": "riddle",
          "kind": "EVENT",
          "title": "…",
          "startAt": "@-1d/10:00",
          "endAt": "@+14d/03:59",
          "timing": "auto",
          "event": {
            "eventType": "IN_GAME",
            "eligibility": null,
            "rewardSummary": null,
            "rewards": [],
          },
        },
      ],
    },
  ],
}
```

Relative times: `@now`, `@±<n>d<n>h<n>m`, `@±<n>d/HH:mm` (local date of the anchor in the file's zone). Item
`sourceKey` = `<externalId>#<key>`; `relatedSourceKey`/`compensationSourceKey` reference that form.

## HTTP client behaviour

| Concern              | Behaviour                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Identity             | `User-Agent: GAMEPULSE-Collector/0.1 (+<COLLECTOR_CONTACT>)`                                                       |
| Rate limits          | sliding window per bucket (default 1 req/s per host) + `X-RateLimit-Limit/Remaining/Reset` and `Retry-After`       |
| Retries              | 408/425/429/5xx and network errors, exponential backoff with full jitter (max 3 retries)                           |
| Conditional requests | `If-None-Match` / `If-Modified-Since` from the last stored document                                                |
| robots.txt           | enforced with `respectRobots: true` (required for website collectors); 4xx ⇒ allowed, 5xx/unreachable ⇒ disallowed |
| Protection pages     | 403/429/503 challenge pages raise `BlockedByProtectionError` — never retried, never bypassed                       |

In environments that require an HTTPS proxy (e.g. the Claude Code cloud sandbox), Node's built-in `fetch` only uses
it with `NODE_USE_ENV_PROXY=1`.

## Manual ingestion

`pnpm ingest:manual <file.json>` reads `{ gameId, note?, items: [...] }`. Items are `NormalizedCandidate`s with
conveniences (defaults for optional fields; `sourceKey` derived from kind/title/start when omitted). The file is a raw
document like any other (hashing, validation, provenance, `MANUAL_VERIFIED`). Example:
`fixtures/manual/lol-patch-schedule.json` (Riot's official patch dates, `precision: DATE`).
