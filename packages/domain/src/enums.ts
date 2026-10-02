/**
 * Canonical enumerations shared by every GAMEPULSE package.
 *
 * Each enumeration is a readonly tuple so it can drive Zod enums, Drizzle pgEnums
 * and exhaustive TypeScript unions from a single definition.
 */

/** Stored content categories. RESET and DEADLINE are derived (reset rules / endAt), not stored. */
export const CONTENT_TYPES = [
  'PATCH',
  'UPDATE',
  'EVENT',
  'REWARD',
  'REDEEM_CODE',
  'MAINTENANCE',
  'BANNER',
  'ANNOUNCEMENT',
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** Where a record came from. Order of authority is defined in SOURCE_TYPE_AUTHORITY. */
export const SOURCE_TYPES = [
  'OFFICIAL_API',
  'OFFICIAL_FEED',
  'OFFICIAL_WEB',
  'MANUAL',
  'TRUSTED_FALLBACK',
  'FIXTURE',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Lower number = more authoritative. A candidate may only overwrite an existing record
 * originating from a source of equal or lower authority (higher number).
 */
export const SOURCE_TYPE_AUTHORITY: Readonly<Record<SourceType, number>> = {
  OFFICIAL_API: 1,
  OFFICIAL_FEED: 2,
  OFFICIAL_WEB: 3,
  MANUAL: 4,
  TRUSTED_FALLBACK: 5,
  FIXTURE: 6,
};

export const OFFICIAL_SOURCE_TYPES: readonly SourceType[] = [
  'OFFICIAL_API',
  'OFFICIAL_FEED',
  'OFFICIAL_WEB',
];

/** Whether automated collection is allowed for a source. */
export const COLLECTOR_STATUSES = [
  'ENABLED',
  'DISABLED',
  'MANUAL_ONLY',
  'FIXTURE_ONLY',
  'PENDING_REVIEW',
] as const;
export type CollectorStatus = (typeof COLLECTOR_STATUSES)[number];

export const SOURCE_AUTHENTICATION = ['NONE', 'API_KEY', 'NOT_APPLICABLE'] as const;
export type SourceAuthentication = (typeof SOURCE_AUTHENTICATION)[number];

/** Human/automatic verification — independent from parser confidence. */
export const VERIFICATION_STATES = [
  'AUTO_VERIFIED',
  'MANUAL_VERIFIED',
  'UNVERIFIED',
  'REJECTED',
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

/** Outcome of the deterministic validation engine. Ordered from best to worst. */
export const VALIDATION_STATUSES = ['VALID', 'WARNING', 'REVIEW', 'INVALID'] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

/** Editorial lifecycle of a stored record. Time-based status is computed, never stored. */
export const CONTENT_STATUSES = ['PUBLISHED', 'PENDING_REVIEW', 'REJECTED', 'ARCHIVED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Computed from startAt/endAt and the current time. */
export const TIME_STATUSES = ['UPCOMING', 'LIVE', 'ENDING_SOON', 'ENDED', 'UNKNOWN'] as const;
export type TimeStatus = (typeof TIME_STATUSES)[number];

export const REWARD_STATES = [
  'AVAILABLE',
  'UPCOMING',
  'ENDING_SOON',
  'EXPIRED',
  'UNKNOWN',
] as const;
export type RewardState = (typeof REWARD_STATES)[number];

export const MAINTENANCE_STATES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'UNKNOWN'] as const;
export type MaintenanceState = (typeof MAINTENANCE_STATES)[number];

export const EVENT_TYPES = [
  'IN_GAME',
  'WEB',
  'LOGIN',
  'LIMITED_MODE',
  'COLLAB',
  'SEASONAL',
  'OTHER',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const REWARD_TYPES = [
  'EVENT',
  'ATTENDANCE',
  'LOGIN',
  'COMPENSATION',
  'REDEEM_CODE',
  'WEB_EVENT',
  'OTHER',
] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

export const MAINTENANCE_TYPES = ['SCHEDULED', 'EMERGENCY', 'EXTENDED'] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

export const BANNER_TYPES = [
  'CHARACTER',
  'WEAPON',
  'STANDARD',
  'CHRONICLED',
  'COLLAB',
  'OTHER',
] as const;
export type BannerType = (typeof BANNER_TYPES)[number];

export const PATCH_CHANGE_TYPES = [
  'BUFF',
  'NERF',
  'ADJUST',
  'NEW',
  'REMOVED',
  'REWORK',
  'FIX',
  'SYSTEM',
] as const;
export type PatchChangeType = (typeof PATCH_CHANGE_TYPES)[number];

export const ENTITY_TYPES = [
  'CHAMPION',
  'ITEM',
  'RUNE',
  'CHARACTER',
  'WEAPON',
  'CLASS',
  'BOSS',
  'MODE',
  'SYSTEM',
  'OTHER',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const RESET_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM_RRULE'] as const;
export type ResetFrequency = (typeof RESET_FREQUENCIES)[number];

export const INGESTION_RUN_STATUSES = [
  'RUNNING',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'ABANDONED',
] as const;
export type IngestionRunStatus = (typeof INGESTION_RUN_STATUSES)[number];

export const INGESTION_TRIGGERS = [
  'CLI',
  'SCHEDULE',
  'MANUAL',
  'SEED',
  'TEST',
  'WEB_FIXTURES',
] as const;
export type IngestionTrigger = (typeof INGESTION_TRIGGERS)[number];

/**
 * fixture: synthetic GAMEPULSE fixture feed (rich content for every type, no network).
 * mock:    a real source adapter running against recorded/synthetic HTTP responses.
 * live:    a real source adapter against the real source (may need credentials).
 */
export const COLLECTOR_MODES = ['fixture', 'mock', 'live'] as const;
export type CollectorMode = (typeof COLLECTOR_MODES)[number];

export const FEATURE_SUPPORT = ['supported', 'limited', 'unsupported'] as const;
export type FeatureSupport = (typeof FEATURE_SUPPORT)[number];

export const GAME_STATUSES = ['ACTIVE', 'BETA', 'INACTIVE'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const PROVENANCE_ROLES = ['PRIMARY', 'SUPPORTING'] as const;
export type ProvenanceRole = (typeof PROVENANCE_ROLES)[number];

export const LOCALIZATION_ORIGINS = ['SOURCE', 'HUMAN', 'MACHINE'] as const;
export type LocalizationOrigin = (typeof LOCALIZATION_ORIGINS)[number];

/** Kinds shown in the unified PULSE stream. */
export const PULSE_KINDS = [
  'PATCH',
  'UPDATE',
  'EVENT_START',
  'EVENT_ENDING',
  'REWARD',
  'REDEEM_CODE',
  'MAINTENANCE',
  'RESET',
  'BANNER_START',
  'BANNER_END',
  'ANNOUNCEMENT',
] as const;
export type PulseKind = (typeof PULSE_KINDS)[number];

export function isOfficialSourceType(type: SourceType): boolean {
  return OFFICIAL_SOURCE_TYPES.includes(type);
}

const VALIDATION_RANK: Readonly<Record<ValidationStatus, number>> = {
  VALID: 0,
  WARNING: 1,
  REVIEW: 2,
  INVALID: 3,
};

/** Returns the more severe of two validation statuses. */
export function worstValidationStatus(a: ValidationStatus, b: ValidationStatus): ValidationStatus {
  return VALIDATION_RANK[a] >= VALIDATION_RANK[b] ? a : b;
}
