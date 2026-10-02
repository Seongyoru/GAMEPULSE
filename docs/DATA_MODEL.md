# GAMEPULSE — Data model

PostgreSQL is the source of truth (schema: `packages/database/src/schema.ts`, migrations: `packages/database/drizzle/`).
All instants are `timestamptz` in UTC. Time-based status is computed, not stored.

## Entity map

| Spec entity         | Table(s)                          | Notes                                                                                                                      |
| ------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Game                | `games`                           | Synced from the code registry (`packages/domain/src/games/registry.ts`); localized names in `localizations`                |
| Source              | `sources`                         | Synced from adapter/manual source definitions; policy fields (collector status, terms review date, attribution, retention) |
| ContentItem         | `content_items`                   | Shared fields for every content type                                                                                       |
| Patch / PatchChange | `patches`, `patch_changes`        | Structured before/after values per target (champion, item, system…)                                                        |
| Event               | `events` (+ `reward_items`)       | Event type, eligibility, reward summary and reward lines                                                                   |
| Reward              | `rewards`, `reward_items`         | Claim window = `content_items.start_at/end_at`; one line per item × quantity                                               |
| RedeemCode          | `redeem_codes` (+ `reward_items`) | Synthetic codes are `GPTEST-…` and flagged `is_synthetic`                                                                  |
| Maintenance         | `maintenances`                    | Type, affected servers, link to compensation reward                                                                        |
| Banner              | `banners`, `banner_featured`      | Banner type, phase, featured units                                                                                         |
| ResetRule           | `reset_rules`                     | Recurrence definitions (never materialized per day)                                                                        |
| GameEntity          | `game_entities`                   | Canonical, locale-independent keys (e.g. Data Dragon champion id)                                                          |
| Localization        | `localizations`                   | `(entity_kind, entity_id, locale, field) → value`, origin SOURCE/HUMAN/MACHINE                                             |
| IngestionRun        | `ingestion_runs`                  | Counters (discovered, fetched, new, updated, unchanged, failed, skipped), status, error                                    |
| RawDocument         | `raw_documents`                   | Content hash, fetch metadata (status, ETag, Last-Modified), internal raw text (pruned)                                     |
| ParseResult         | `parse_results`                   | Parser id/version + input hash (cache key), output JSON, model/usage                                                       |
| ValidationResult    | `validation_results`              | Status (VALID/WARNING/REVIEW/INVALID) and issues per candidate                                                             |
| (provenance)        | `content_sources`                 | Every source that reported a record, role PRIMARY/SUPPORTING, first/last seen                                              |

## `content_items`

| Column                                                                                          | Purpose                                                                                                              |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                            | Deterministic UUID of `(source_id, source_key)`                                                                      |
| `game_id`, `type`                                                                               | Game and content type (`PATCH`, `UPDATE`, `EVENT`, `REWARD`, `REDEEM_CODE`, `MAINTENANCE`, `BANNER`, `ANNOUNCEMENT`) |
| `title`, `slug`, `summary`                                                                      | Plain text (sanitized); slug is ASCII, unique, immutable                                                             |
| `start_at`, `end_at`                                                                            | Normalized UTC instants (check: `end_at >= start_at`)                                                                |
| `source_timezone`, `start_at_source`, `end_at_source`, `region`, `time_precision`, `has_timing` | The source's own wording and zone, preserved for audit; `DATE` precision for date-only facts                         |
| `published_at`, `source_published_at`                                                           | First GAMEPULSE publication / official publication time                                                              |
| `status`                                                                                        | Editorial lifecycle: `PUBLISHED`, `PENDING_REVIEW`, `REJECTED`, `ARCHIVED`                                           |
| `priority`                                                                                      | 0–100 editorial weight                                                                                               |
| `source_id`, `source_key`, `source_url`, `source_locale`, `raw_document_id`                     | Primary provenance (unique `(source_id, source_key)`)                                                                |
| `semantic_key`                                                                                  | Cross-source identity: game + kind + normalized title + UTC start day (patch: version; code: code)                   |
| `content_hash`                                                                                  | SHA-256 of the normalized candidate — unchanged hash ⇒ no write                                                      |
| `confidence`                                                                                    | Parser confidence 0–1 (separate from verification)                                                                   |
| `verification`, `verified_at`                                                                   | `AUTO_VERIFIED`, `MANUAL_VERIFIED`, `UNVERIFIED`, `REJECTED`                                                         |
| `validation_status`                                                                             | Last validation outcome                                                                                              |
| `parser_id`, `parser_version`                                                                   | Which parser produced the record                                                                                     |
| `is_synthetic`                                                                                  | Fixture data flag (always labelled in the UI)                                                                        |
| `evidence`                                                                                      | JSONB `[{field, excerpt}]` short source excerpts                                                                     |
| `metadata`                                                                                      | JSONB source-specific extras only                                                                                    |
| `last_seen_at`, `created_at`, `updated_at`                                                      | Freshness                                                                                                            |

Indexes: `(game_id, type)`, `type`, `status`, `start_at`, `end_at`, `published_at`, `(game_id, semantic_key)`,
`content_hash`, unique `slug`, unique `(source_id, source_key)`.

## Computed (never stored)

- Time status `UPCOMING / LIVE / ENDING_SOON / ENDED / UNKNOWN` (ending soon = < 48 h; per-type overrides)
- Reward state `AVAILABLE / UPCOMING / ENDING_SOON / EXPIRED / UNKNOWN`
- Maintenance state `SCHEDULED / IN_PROGRESS / COMPLETED / UNKNOWN`
- Reset occurrences from `reset_rules`
- Urgency tier for TODAY ordering

## Read model

`ContentRecord` (domain) is returned by both stores: shared fields + `source` summary + full `provenance` + typed
`detail` (patch changes, reward lines, featured units, related slugs). `PulseItem` is the compact projection sent to
client components.

## Localization

Canonical entities (games, game entities, content) keep one canonical record; per-locale strings live in
`localizations`. Content keeps its original source-language text (`source_locale`); translations are separate rows
(origin `HUMAN` or `MACHINE`). Slugs are locale-independent.

## Retention

- `raw_documents.raw_text` is pruned after `RAW_TEXT_RETENTION_DAYS` (`pnpm cli prune`); hashes and metadata stay.
- Sources with terms-imposed TTLs declare `data_retention_days` (e.g. NEXON's 30-day TTL in its English terms).
