/**
 * GAMEPULSE PostgreSQL schema (source of truth). Generate migrations with `pnpm db:generate`.
 *
 * Modeling rules:
 *   - content_items holds the fields shared by every content type; typed detail tables
 *     (patches, events, rewards, redeem_codes, maintenances, banners) extend it 1:1.
 *   - Provenance is never lost: content_items keeps the primary source; content_sources keeps
 *     every source that ever reported the record.
 *   - Time-based status is computed at read time and therefore not stored.
 *   - JSONB is only used for source-specific metadata, evidence excerpts and run diagnostics.
 */
import {
  BANNER_TYPES,
  COLLECTOR_MODES,
  COLLECTOR_STATUSES,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  ENTITY_TYPES,
  EVENT_TYPES,
  GAME_STATUSES,
  INGESTION_RUN_STATUSES,
  INGESTION_TRIGGERS,
  LOCALIZATION_ORIGINS,
  MAINTENANCE_TYPES,
  PATCH_CHANGE_TYPES,
  PROVENANCE_ROLES,
  RESET_FREQUENCIES,
  REWARD_TYPES,
  SOURCE_AUTHENTICATION,
  SOURCE_TYPES,
  VALIDATION_STATUSES,
  VERIFICATION_STATES,
  type Evidence,
  type JsonValue,
  type ValidationIssue,
} from '@gamepulse/domain';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => timestamptz('created_at').notNull().defaultNow();
const updatedAt = () => timestamptz('updated_at').notNull().defaultNow();

export const gameStatusEnum = pgEnum('game_status', GAME_STATUSES);
export const sourceTypeEnum = pgEnum('source_type', SOURCE_TYPES);
export const sourceAuthenticationEnum = pgEnum('source_authentication', SOURCE_AUTHENTICATION);
export const collectorStatusEnum = pgEnum('collector_status', COLLECTOR_STATUSES);
export const contentTypeEnum = pgEnum('content_type', CONTENT_TYPES);
export const contentStatusEnum = pgEnum('content_status', CONTENT_STATUSES);
export const verificationStateEnum = pgEnum('verification_state', VERIFICATION_STATES);
export const validationStatusEnum = pgEnum('validation_status', VALIDATION_STATUSES);
export const eventTypeEnum = pgEnum('event_type', EVENT_TYPES);
export const rewardTypeEnum = pgEnum('reward_type', REWARD_TYPES);
export const maintenanceTypeEnum = pgEnum('maintenance_type', MAINTENANCE_TYPES);
export const bannerTypeEnum = pgEnum('banner_type', BANNER_TYPES);
export const patchChangeTypeEnum = pgEnum('patch_change_type', PATCH_CHANGE_TYPES);
export const entityTypeEnum = pgEnum('entity_type', ENTITY_TYPES);
export const resetFrequencyEnum = pgEnum('reset_frequency', RESET_FREQUENCIES);
export const ingestionRunStatusEnum = pgEnum('ingestion_run_status', INGESTION_RUN_STATUSES);
export const ingestionTriggerEnum = pgEnum('ingestion_trigger', INGESTION_TRIGGERS);
export const collectorModeEnum = pgEnum('collector_mode', COLLECTOR_MODES);
export const provenanceRoleEnum = pgEnum('provenance_role', PROVENANCE_ROLES);
export const localizationOriginEnum = pgEnum('localization_origin', LOCALIZATION_ORIGINS);
export const parseStatusEnum = pgEnum('parse_status', ['SUCCEEDED', 'FAILED']);
export const timePrecisionEnum = pgEnum('time_precision', ['DATETIME', 'DATE']);

/** Registry-derived configuration that has no dedicated columns (regions, features, adapters…). */
export interface GameConfigSnapshot {
  regions: Array<{ id: string; timezone: string; isDefault: boolean }>;
  features: Record<string, string>;
  adapters: string[];
  accent: string;
  sortOrder: number;
}

export const games = pgTable('games', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  publisher: text('publisher').notNull(),
  developer: text('developer').notNull(),
  defaultTimezone: text('default_timezone').notNull(),
  officialUrl: text('official_url').notNull(),
  status: gameStatusEnum('status').notNull(),
  config: jsonb('config').$type<GameConfigSnapshot>().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sources = pgTable(
  'sources',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    name: text('name').notNull(),
    type: sourceTypeEnum('type').notNull(),
    isOfficial: boolean('is_official').notNull(),
    homepageUrl: text('homepage_url').notNull(),
    allowedHosts: text('allowed_hosts').array().notNull(),
    authentication: sourceAuthenticationEnum('authentication').notNull(),
    rateLimit: text('rate_limit'),
    contentTypes: text('content_types').array().notNull(),
    collectorStatus: collectorStatusEnum('collector_status').notNull(),
    termsUrl: text('terms_url'),
    termsReviewedAt: date('terms_reviewed_at', { mode: 'string' }),
    robotsPolicy: text('robots_policy'),
    attribution: text('attribution'),
    dataRetentionDays: integer('data_retention_days'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('sources_game_id_idx').on(t.gameId)],
);

export const ingestionRuns = pgTable(
  'ingestion_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adapterId: text('adapter_id').notNull(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    trigger: ingestionTriggerEnum('trigger').notNull(),
    mode: collectorModeEnum('mode').notNull(),
    status: ingestionRunStatusEnum('status').notNull(),
    startedAt: timestamptz('started_at').notNull(),
    finishedAt: timestamptz('finished_at'),
    discovered: integer('discovered').notNull().default(0),
    fetched: integer('fetched').notNull().default(0),
    newCount: integer('new_count').notNull().default(0),
    updatedCount: integer('updated_count').notNull().default(0),
    unchanged: integer('unchanged').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
    error: text('error'),
  },
  (t) => [
    // Run lock: at most one RUNNING run per adapter, enforced by PostgreSQL.
    uniqueIndex('ingestion_runs_one_running_per_adapter')
      .on(t.adapterId)
      .where(sql`${t.status} = 'RUNNING'`),
    index('ingestion_runs_started_at_idx').on(t.startedAt),
    index('ingestion_runs_source_idx').on(t.sourceId),
  ],
);

export const rawDocuments = pgTable(
  'raw_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    documentKey: text('document_key').notNull(),
    externalId: text('external_id'),
    url: text('url').notNull(),
    contentHash: text('content_hash').notNull(),
    contentType: text('content_type').notNull(),
    rawText: text('raw_text'),
    fetchedAt: timestamptz('fetched_at').notNull(),
    lastCheckedAt: timestamptz('last_checked_at').notNull(),
    httpStatus: integer('http_status'),
    etag: text('etag'),
    lastModified: text('last_modified'),
    locale: text('locale'),
    ingestionRunId: uuid('ingestion_run_id').references(() => ingestionRuns.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<{ [key: string]: JsonValue }>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('raw_documents_source_document_hash_uq').on(t.sourceId, t.documentKey, t.contentHash),
    index('raw_documents_source_document_fetched_idx').on(t.sourceId, t.documentKey, t.fetchedAt),
    index('raw_documents_content_hash_idx').on(t.contentHash),
  ],
);

export const parseResults = pgTable(
  'parse_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rawDocumentId: uuid('raw_document_id').references(() => rawDocuments.id, { onDelete: 'set null' }),
    parserId: text('parser_id').notNull(),
    parserVersion: text('parser_version').notNull(),
    inputHash: text('input_hash').notNull(),
    status: parseStatusEnum('status').notNull(),
    output: jsonb('output').$type<JsonValue>(),
    error: text('error'),
    model: text('model'),
    usage: jsonb('usage').$type<JsonValue>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('parse_results_cache_uq').on(t.inputHash, t.parserId, t.parserVersion)],
);

export const gameEntities = pgTable(
  'game_entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    type: entityTypeEnum('type').notNull(),
    /** Canonical, locale-independent key (e.g. Data Dragon champion id). */
    key: text('key').notNull(),
    /** Name as first observed; per-locale names live in `localizations`. */
    name: text('name').notNull(),
    nameLocale: text('name_locale').notNull(),
    metadata: jsonb('metadata').$type<{ [key: string]: JsonValue }>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('game_entities_game_type_key_uq').on(t.gameId, t.type, t.key)],
);

export const contentItems = pgTable(
  'content_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    type: contentTypeEnum('type').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    summary: text('summary'),
    startAt: timestamptz('start_at'),
    endAt: timestamptz('end_at'),
    /** Time zone exactly as stated by the source, plus the original strings. */
    sourceTimezone: text('source_timezone'),
    startAtSource: text('start_at_source'),
    endAtSource: text('end_at_source'),
    region: text('region'),
    timePrecision: timePrecisionEnum('time_precision').notNull().default('DATETIME'),
    hasTiming: boolean('has_timing').notNull().default(false),
    publishedAt: timestamptz('published_at').notNull(),
    sourcePublishedAt: timestamptz('source_published_at'),
    status: contentStatusEnum('status').notNull(),
    priority: smallint('priority').notNull().default(50),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    sourceKey: text('source_key').notNull(),
    sourceUrl: text('source_url').notNull(),
    sourceLocale: text('source_locale').notNull(),
    rawDocumentId: uuid('raw_document_id').references(() => rawDocuments.id, { onDelete: 'set null' }),
    semanticKey: text('semantic_key').notNull(),
    contentHash: text('content_hash').notNull(),
    confidence: real('confidence').notNull(),
    verification: verificationStateEnum('verification').notNull(),
    verifiedAt: timestamptz('verified_at'),
    validationStatus: validationStatusEnum('validation_status').notNull(),
    parserId: text('parser_id').notNull(),
    parserVersion: text('parser_version').notNull(),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    evidence: jsonb('evidence').$type<Evidence[]>().notNull().default(sql`'[]'::jsonb`),
    metadata: jsonb('metadata').$type<{ [key: string]: JsonValue }>(),
    lastSeenAt: timestamptz('last_seen_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('content_items_source_key_uq').on(t.sourceId, t.sourceKey),
    index('content_items_game_type_idx').on(t.gameId, t.type),
    index('content_items_type_idx').on(t.type),
    index('content_items_status_idx').on(t.status),
    index('content_items_start_at_idx').on(t.startAt),
    index('content_items_end_at_idx').on(t.endAt),
    index('content_items_published_at_idx').on(t.publishedAt),
    index('content_items_semantic_key_idx').on(t.gameId, t.semanticKey),
    index('content_items_content_hash_idx').on(t.contentHash),
    check('content_items_chronology', sql`${t.endAt} IS NULL OR ${t.startAt} IS NULL OR ${t.endAt} >= ${t.startAt}`),
    check('content_items_priority_range', sql`${t.priority} BETWEEN 0 AND 100`),
    check('content_items_confidence_range', sql`${t.confidence} >= 0 AND ${t.confidence} <= 1`),
  ],
);

/** Every source that reported a record (provenance history; never deleted with re-ingestion). */
export const contentSources = pgTable(
  'content_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    sourceKey: text('source_key').notNull(),
    sourceUrl: text('source_url').notNull(),
    rawDocumentId: uuid('raw_document_id').references(() => rawDocuments.id, { onDelete: 'set null' }),
    role: provenanceRoleEnum('role').notNull(),
    firstSeenAt: timestamptz('first_seen_at').notNull(),
    lastSeenAt: timestamptz('last_seen_at').notNull(),
  },
  (t) => [
    uniqueIndex('content_sources_item_source_key_uq').on(t.contentItemId, t.sourceId, t.sourceKey),
    index('content_sources_source_key_idx').on(t.sourceId, t.sourceKey),
  ],
);

export const patches = pgTable('patches', {
  contentItemId: uuid('content_item_id')
    .primaryKey()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  releaseAt: timestamptz('release_at'),
});

export const patchChanges = pgTable(
  'patch_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    patchId: uuid('patch_id')
      .notNull()
      .references(() => patches.contentItemId, { onDelete: 'cascade' }),
    targetType: entityTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').references(() => gameEntities.id, { onDelete: 'set null' }),
    targetKey: text('target_key'),
    targetName: text('target_name').notNull(),
    changeType: patchChangeTypeEnum('change_type').notNull(),
    field: text('field'),
    beforeValue: text('before_value'),
    afterValue: text('after_value'),
    unit: text('unit'),
    description: text('description'),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [index('patch_changes_patch_idx').on(t.patchId, t.sortOrder), index('patch_changes_target_idx').on(t.targetId)],
);

export const events = pgTable('events', {
  contentItemId: uuid('content_item_id')
    .primaryKey()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  eventType: eventTypeEnum('event_type').notNull(),
  eligibility: text('eligibility'),
  rewardSummary: text('reward_summary'),
});

/** A claimable reward (claim window = content_items.start_at/end_at). */
export const rewards = pgTable('rewards', {
  contentItemId: uuid('content_item_id')
    .primaryKey()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  rewardType: rewardTypeEnum('reward_type').notNull(),
  howToClaim: text('how_to_claim'),
  relatedSourceKey: text('related_source_key'),
});

/** Individual reward lines (name × quantity) of a reward, redeem code or event. */
export const rewardItems = pgTable(
  'reward_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    quantity: doublePrecision('quantity'),
    unit: text('unit'),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [
    index('reward_items_content_item_idx').on(t.contentItemId, t.sortOrder),
    check('reward_items_quantity_positive', sql`${t.quantity} IS NULL OR ${t.quantity} > 0`),
  ],
);

export const redeemCodes = pgTable(
  'redeem_codes',
  {
    contentItemId: uuid('content_item_id')
      .primaryKey()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    region: text('region'),
  },
  (t) => [index('redeem_codes_code_idx').on(t.code)],
);

export const maintenances = pgTable('maintenances', {
  contentItemId: uuid('content_item_id')
    .primaryKey()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  maintenanceType: maintenanceTypeEnum('maintenance_type').notNull(),
  affectedServers: text('affected_servers').array().notNull().default(sql`'{}'::text[]`),
  compensationSourceKey: text('compensation_source_key'),
});

export const banners = pgTable('banners', {
  contentItemId: uuid('content_item_id')
    .primaryKey()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  bannerType: bannerTypeEnum('banner_type').notNull(),
  phase: smallint('phase'),
});

export const bannerFeatured = pgTable(
  'banner_featured',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bannerId: uuid('banner_id')
      .notNull()
      .references(() => banners.contentItemId, { onDelete: 'cascade' }),
    entityId: uuid('entity_id').references(() => gameEntities.id, { onDelete: 'set null' }),
    entityKey: text('entity_key'),
    name: text('name').notNull(),
    rarity: smallint('rarity'),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [index('banner_featured_banner_idx').on(t.bannerId, t.sortOrder)],
);

export const resetRules = pgTable(
  'reset_rules',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    name: text('name').notNull(),
    frequency: resetFrequencyEnum('frequency').notNull(),
    timezone: text('timezone').notNull(),
    hour: smallint('hour').notNull(),
    minute: smallint('minute').notNull(),
    dayOfWeek: smallint('day_of_week'),
    dayOfMonth: smallint('day_of_month'),
    rrule: text('rrule'),
    anchor: timestamptz('anchor'),
    region: text('region'),
    isPrimary: boolean('is_primary').notNull().default(false),
    verification: verificationStateEnum('verification').notNull(),
    isSynthetic: boolean('is_synthetic').notNull().default(false),
    sourceUrl: text('source_url'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('reset_rules_game_idx').on(t.gameId),
    check('reset_rules_hour_range', sql`${t.hour} BETWEEN 0 AND 23`),
    check('reset_rules_minute_range', sql`${t.minute} BETWEEN 0 AND 59`),
    check('reset_rules_day_of_week_range', sql`${t.dayOfWeek} IS NULL OR ${t.dayOfWeek} BETWEEN 1 AND 7`),
  ],
);

/** Locale-specific text for canonical entities (games, game entities, content, reset rules). */
export const localizations = pgTable(
  'localizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityKind: text('entity_kind').notNull(),
    entityId: text('entity_id').notNull(),
    locale: text('locale').notNull(),
    field: text('field').notNull(),
    value: text('value').notNull(),
    origin: localizationOriginEnum('origin').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('localizations_entity_locale_field_uq').on(t.entityKind, t.entityId, t.locale, t.field)],
);

export const validationResults = pgTable(
  'validation_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ingestionRunId: uuid('ingestion_run_id').references(() => ingestionRuns.id, { onDelete: 'set null' }),
    rawDocumentId: uuid('raw_document_id').references(() => rawDocuments.id, { onDelete: 'set null' }),
    contentItemId: uuid('content_item_id').references(() => contentItems.id, { onDelete: 'set null' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    candidateKey: text('candidate_key').notNull(),
    status: validationStatusEnum('status').notNull(),
    issues: jsonb('issues').$type<ValidationIssue[]>().notNull(),
    validatorVersion: text('validator_version').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('validation_results_run_idx').on(t.ingestionRunId),
    index('validation_results_content_idx').on(t.contentItemId),
    index('validation_results_status_idx').on(t.status),
  ],
);
