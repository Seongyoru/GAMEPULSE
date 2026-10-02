/**
 * NormalizedCandidate — the single contract between source adapters / parsers and the
 * ingestion pipeline. Every collector, the manual ingestion CLI and every AI parser must
 * produce values that satisfy `normalizedCandidateSchema`.
 *
 * Rules encoded here:
 *   - All instants are ISO-8601 strings normalized to UTC by the producer.
 *   - The original timing text and time zone stated by the source are preserved in `timing`.
 *   - Unknown values are null — producers must never invent dates, rewards or values.
 *   - `evidence` links extracted fields to short excerpts of the source document.
 */
import { z } from 'zod';
import {
  BANNER_TYPES,
  type CONTENT_TYPES,
  ENTITY_TYPES,
  EVENT_TYPES,
  MAINTENANCE_TYPES,
  PATCH_CHANGE_TYPES,
  REWARD_TYPES,
} from '../enums';

export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const evidenceSchema = z.object({
  /** Dotted path of the candidate field this excerpt supports, e.g. "endAt" or "redeemCode.code". */
  field: z.string().min(1).max(80),
  /** Short verbatim excerpt from the source document. */
  excerpt: z.string().min(1).max(500),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const candidateTimingSchema = z.object({
  /** Time zone exactly as stated or implied by the source (IANA name or "UTC+8"). */
  sourceTimezone: z.string().min(1).max(64).nullable(),
  /** Original start value as written by the source, e.g. "2026/10/08 10:00 (UTC+8)". */
  startAtSource: z.string().min(1).max(160).nullable(),
  /** Original end value as written by the source. */
  endAtSource: z.string().min(1).max(160).nullable(),
  /** Server region the normalized UTC instants apply to (e.g. "asia"), when region-specific. */
  region: z.string().min(1).max(32).nullable(),
  /**
   * DATE when the source only states a calendar date (e.g. "Oct 7 (PT)"): the instants are the
   * start of that date in `sourceTimezone` and the UI must not display a time of day.
   */
  precision: z.enum(['DATETIME', 'DATE']),
});
export type CandidateTiming = z.infer<typeof candidateTimingSchema>;

export const rewardItemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().finite().positive().nullable(),
  unit: z.string().min(1).max(40).nullable(),
});
export type RewardItem = z.infer<typeof rewardItemSchema>;

export const patchChangeCandidateSchema = z.object({
  targetType: z.enum(ENTITY_TYPES),
  /** Canonical entity key (e.g. "ahri") when resolvable; null otherwise. */
  targetKey: z.string().min(1).max(80).nullable(),
  /** Display name as written by the source. */
  targetName: z.string().min(1).max(120),
  changeType: z.enum(PATCH_CHANGE_TYPES),
  /** Changed attribute, e.g. "Q 피해량". Null for whole-target changes. */
  field: z.string().min(1).max(160).nullable(),
  beforeValue: z.string().min(1).max(160).nullable(),
  afterValue: z.string().min(1).max(160).nullable(),
  unit: z.string().min(1).max(40).nullable(),
  description: z.string().min(1).max(500).nullable(),
});
export type PatchChangeCandidate = z.infer<typeof patchChangeCandidateSchema>;

export const bannerFeaturedSchema = z.object({
  name: z.string().min(1).max(120),
  entityKey: z.string().min(1).max(80).nullable(),
  rarity: z.number().int().min(1).max(6).nullable(),
});
export type BannerFeatured = z.infer<typeof bannerFeaturedSchema>;

const SLUG_HINT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const candidateBase = {
  gameId: z.string().min(1).max(40),
  /** Stable identity of this item within its source (external id, or external id + fragment). */
  sourceKey: z.string().min(1).max(300),
  /** Optional ASCII hint used to build a stable, readable URL slug. */
  slugHint: z.string().regex(SLUG_HINT).max(80).nullable(),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(600).nullable(),
  startAt: isoDateTimeSchema.nullable(),
  endAt: isoDateTimeSchema.nullable(),
  timing: candidateTimingSchema.nullable(),
  sourceUrl: z.url({ protocol: /^https?$/ }),
  sourcePublishedAt: isoDateTimeSchema.nullable(),
  sourceLocale: z.string().min(2).max(16),
  /** Editorial weight 0-100 (50 = normal). */
  priority: z.number().int().min(0).max(100),
  /** Parser confidence 0-1. Deterministic parsers use 1. Separate from verification. */
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema).max(40),
  /** True for synthetic fixture data. Synthetic content is always labelled in the UI. */
  isSynthetic: z.boolean(),
  /** Source-specific extras (JSON). Never used for core domain fields. */
  metadata: z.record(z.string(), z.json()).nullable(),
};

export const patchCandidateSchema = z.object({
  kind: z.literal('PATCH'),
  ...candidateBase,
  patch: z.object({
    version: z.string().min(1).max(40),
    releaseAt: isoDateTimeSchema.nullable(),
    changes: z.array(patchChangeCandidateSchema).max(500),
  }),
});

export const updateCandidateSchema = z.object({
  kind: z.literal('UPDATE'),
  ...candidateBase,
});

export const eventCandidateSchema = z.object({
  kind: z.literal('EVENT'),
  ...candidateBase,
  event: z.object({
    eventType: z.enum(EVENT_TYPES),
    eligibility: z.string().min(1).max(300).nullable(),
    rewardSummary: z.string().min(1).max(300).nullable(),
    rewards: z.array(rewardItemSchema).max(50),
  }),
});

export const rewardCandidateSchema = z.object({
  kind: z.literal('REWARD'),
  ...candidateBase,
  reward: z.object({
    rewardType: z.enum(REWARD_TYPES),
    howToClaim: z.string().min(1).max(300).nullable(),
    items: z.array(rewardItemSchema).max(50),
    /** sourceKey of a related item from the same source (event, maintenance). */
    relatedSourceKey: z.string().min(1).max(300).nullable(),
  }),
});

export const redeemCodeCandidateSchema = z.object({
  kind: z.literal('REDEEM_CODE'),
  ...candidateBase,
  redeemCode: z.object({
    code: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{3,39}$/),
    region: z.string().min(1).max(32).nullable(),
    items: z.array(rewardItemSchema).max(50),
  }),
});

export const maintenanceCandidateSchema = z.object({
  kind: z.literal('MAINTENANCE'),
  ...candidateBase,
  maintenance: z.object({
    maintenanceType: z.enum(MAINTENANCE_TYPES),
    affectedServers: z.array(z.string().min(1).max(60)).max(50),
    compensationSourceKey: z.string().min(1).max(300).nullable(),
  }),
});

export const bannerCandidateSchema = z.object({
  kind: z.literal('BANNER'),
  ...candidateBase,
  banner: z.object({
    bannerType: z.enum(BANNER_TYPES),
    phase: z.number().int().positive().max(10).nullable(),
    featured: z.array(bannerFeaturedSchema).max(20),
  }),
});

export const announcementCandidateSchema = z.object({
  kind: z.literal('ANNOUNCEMENT'),
  ...candidateBase,
});

export const normalizedCandidateSchema = z.discriminatedUnion('kind', [
  patchCandidateSchema,
  updateCandidateSchema,
  eventCandidateSchema,
  rewardCandidateSchema,
  redeemCodeCandidateSchema,
  maintenanceCandidateSchema,
  bannerCandidateSchema,
  announcementCandidateSchema,
]);

export type NormalizedCandidate = z.infer<typeof normalizedCandidateSchema>;
export type CandidateKind = NormalizedCandidate['kind'];
export type CandidateOf<K extends CandidateKind> = Extract<NormalizedCandidate, { kind: K }>;

// Compile-time guarantee that candidate kinds and content types stay in sync.
type _KindsMatchContentTypes = CandidateKind extends (typeof CONTENT_TYPES)[number]
  ? (typeof CONTENT_TYPES)[number] extends CandidateKind
    ? true
    : never
  : never;
export const CANDIDATE_KINDS_MATCH_CONTENT_TYPES: _KindsMatchContentTypes = true;
