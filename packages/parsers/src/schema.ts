/**
 * AI output contract. Every parser (AI or rule-based) returns an `AiExtraction` validated by
 * this schema; `extractionToCandidates` maps it onto NormalizedCandidates.
 *
 * Unknown values are null. The contract has no field a model could fill with a guess
 * without leaving evidence, and the validators re-check evidence against the source text.
 */
import {
  BANNER_TYPES,
  CONTENT_TYPES,
  EVENT_TYPES,
  MAINTENANCE_TYPES,
  REWARD_TYPES,
  bannerFeaturedSchema,
  evidenceSchema,
  isoDateTimeSchema,
  patchChangeCandidateSchema,
  rewardItemSchema,
  type NormalizedCandidate,
} from '@gamepulse/domain';
import { z } from 'zod';

export const aiExtractionItemSchema = z.object({
  kind: z.enum(CONTENT_TYPES),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(600).nullable(),
  startAt: isoDateTimeSchema.nullable(),
  endAt: isoDateTimeSchema.nullable(),
  /** Times exactly as written in the source. */
  startAtSource: z.string().min(1).max(160).nullable(),
  endAtSource: z.string().min(1).max(160).nullable(),
  /** Zone stated by the source ("UTC+8", "Asia/Seoul"); null when the source states none. */
  sourceTimezone: z.string().min(1).max(64).nullable(),
  datePrecision: z.enum(['DATETIME', 'DATE']).nullable(),
  eventType: z.enum(EVENT_TYPES).nullable(),
  rewardType: z.enum(REWARD_TYPES).nullable(),
  maintenanceType: z.enum(MAINTENANCE_TYPES).nullable(),
  bannerType: z.enum(BANNER_TYPES).nullable(),
  rewardSummary: z.string().min(1).max(300).nullable(),
  rewards: z.array(rewardItemSchema).max(50),
  redeemCode: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{3,39}$/)
    .nullable(),
  version: z.string().min(1).max(40).nullable(),
  patchChanges: z.array(patchChangeCandidateSchema).max(300),
  featured: z.array(bannerFeaturedSchema).max(20),
  affectedServers: z.array(z.string().min(1).max(60)).max(20),
  evidence: z.array(evidenceSchema).max(40),
  confidence: z.number().min(0).max(1),
});
export type AiExtractionItem = z.infer<typeof aiExtractionItemSchema>;

export const aiExtractionSchema = z.object({ items: z.array(aiExtractionItemSchema).max(50) });
export type AiExtraction = z.infer<typeof aiExtractionSchema>;

export function emptyExtractionItem(
  kind: AiExtractionItem['kind'],
  title: string,
): AiExtractionItem {
  return {
    kind,
    title,
    summary: null,
    startAt: null,
    endAt: null,
    startAtSource: null,
    endAtSource: null,
    sourceTimezone: null,
    datePrecision: null,
    eventType: null,
    rewardType: null,
    maintenanceType: null,
    bannerType: null,
    rewardSummary: null,
    rewards: [],
    redeemCode: null,
    version: null,
    patchChanges: [],
    featured: [],
    affectedServers: [],
    evidence: [],
    confidence: 0,
  };
}

export interface ExtractionContext {
  gameId: string;
  sourceUrl: string;
  sourceLocale: string;
  sourcePublishedAt: string | null;
  /** Prefix for item source keys (usually the document's external id). */
  sourceKeyPrefix: string;
  region: string | null;
}

/**
 * Maps a validated extraction to candidates. Items that cannot form a candidate (e.g. a
 * PATCH without a version, a REDEEM_CODE without a code) are dropped and reported.
 */
export function extractionToCandidates(
  extraction: AiExtraction,
  context: ExtractionContext,
): { candidates: NormalizedCandidate[]; dropped: string[] } {
  const candidates: NormalizedCandidate[] = [];
  const dropped: string[] = [];

  extraction.items.forEach((item, index) => {
    const hasTiming =
      item.startAtSource !== null || item.endAtSource !== null || item.sourceTimezone !== null;
    const base = {
      gameId: context.gameId,
      sourceKey:
        extraction.items.length === 1
          ? context.sourceKeyPrefix
          : `${context.sourceKeyPrefix}#${index}`,
      slugHint: null,
      title: item.title,
      summary: item.summary,
      startAt: item.startAt,
      endAt: item.endAt,
      timing: hasTiming
        ? {
            sourceTimezone: item.sourceTimezone,
            startAtSource: item.startAtSource,
            endAtSource: item.endAtSource,
            region: context.region,
            precision: item.datePrecision ?? 'DATETIME',
          }
        : null,
      sourceUrl: context.sourceUrl,
      sourcePublishedAt: context.sourcePublishedAt,
      sourceLocale: context.sourceLocale,
      priority: 50,
      confidence: item.confidence,
      evidence: item.evidence,
      isSynthetic: false,
      metadata: null,
    };

    switch (item.kind) {
      case 'PATCH':
        if (item.version === null) {
          dropped.push(`item ${index}: PATCH without a version`);
          return;
        }
        candidates.push({
          ...base,
          kind: 'PATCH',
          patch: { version: item.version, releaseAt: item.startAt, changes: item.patchChanges },
        });
        return;
      case 'EVENT':
        candidates.push({
          ...base,
          kind: 'EVENT',
          event: {
            eventType: item.eventType ?? 'OTHER',
            eligibility: null,
            rewardSummary: item.rewardSummary,
            rewards: item.rewards,
          },
        });
        return;
      case 'REWARD':
        candidates.push({
          ...base,
          kind: 'REWARD',
          reward: {
            rewardType: item.rewardType ?? 'OTHER',
            howToClaim: null,
            items: item.rewards,
            relatedSourceKey: null,
          },
        });
        return;
      case 'REDEEM_CODE':
        if (item.redeemCode === null) {
          dropped.push(`item ${index}: REDEEM_CODE without a code`);
          return;
        }
        candidates.push({
          ...base,
          kind: 'REDEEM_CODE',
          redeemCode: { code: item.redeemCode, region: context.region, items: item.rewards },
        });
        return;
      case 'MAINTENANCE':
        candidates.push({
          ...base,
          kind: 'MAINTENANCE',
          maintenance: {
            maintenanceType: item.maintenanceType ?? 'SCHEDULED',
            affectedServers: item.affectedServers,
            compensationSourceKey: null,
          },
        });
        return;
      case 'BANNER':
        candidates.push({
          ...base,
          kind: 'BANNER',
          banner: { bannerType: item.bannerType ?? 'OTHER', phase: null, featured: item.featured },
        });
        return;
      case 'UPDATE':
        candidates.push({ ...base, kind: 'UPDATE' });
        return;
      case 'ANNOUNCEMENT':
        candidates.push({ ...base, kind: 'ANNOUNCEMENT' });
        return;
    }
  });

  return { candidates, dropped };
}
