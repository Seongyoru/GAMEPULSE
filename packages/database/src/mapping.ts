/**
 * Mapping helpers shared by the PostgreSQL and in-memory stores so both produce identical
 * ContentRecords from identical inputs.
 */
import { createHash } from 'node:crypto';
import type {
  ContentDetail,
  EntityType,
  NormalizedCandidate,
  SourceDefinition,
  SourceSummary,
} from '@gamepulse/domain';

/** Formats the first 16 bytes of a SHA-256 digest as an RFC 4122 v4-shaped UUID. */
export function deterministicUuid(seed: string): string {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Stable content id: the same (source, sourceKey) always maps to the same id, so ids survive
 * re-seeding, fixture-mode restarts and store implementations.
 */
export function contentIdFor(sourceId: string, sourceKey: string): string {
  return deterministicUuid(`content:${sourceId}:${sourceKey}`);
}

/** sourceKeys of related records (same source) referenced by a candidate. */
export function relatedSourceKeys(candidate: NormalizedCandidate): {
  related: string | null;
  compensation: string | null;
} {
  return {
    related: candidate.kind === 'REWARD' ? candidate.reward.relatedSourceKey : null,
    compensation:
      candidate.kind === 'MAINTENANCE' ? candidate.maintenance.compensationSourceKey : null,
  };
}

export function candidateDetail(
  candidate: NormalizedCandidate,
  links: { relatedSlug: string | null; compensationSlug: string | null },
): ContentDetail {
  switch (candidate.kind) {
    case 'PATCH':
      return {
        type: 'PATCH',
        version: candidate.patch.version,
        releaseAt: candidate.patch.releaseAt === null ? null : toIso(candidate.patch.releaseAt),
        changes: candidate.patch.changes.map((change) => ({ ...change })),
      };
    case 'EVENT':
      return {
        type: 'EVENT',
        eventType: candidate.event.eventType,
        eligibility: candidate.event.eligibility,
        rewardSummary: candidate.event.rewardSummary,
        rewards: candidate.event.rewards.map((item) => ({ ...item })),
      };
    case 'REWARD':
      return {
        type: 'REWARD',
        rewardType: candidate.reward.rewardType,
        howToClaim: candidate.reward.howToClaim,
        items: candidate.reward.items.map((item) => ({ ...item })),
        relatedSlug: links.relatedSlug,
      };
    case 'REDEEM_CODE':
      return {
        type: 'REDEEM_CODE',
        code: candidate.redeemCode.code,
        region: candidate.redeemCode.region,
        items: candidate.redeemCode.items.map((item) => ({ ...item })),
      };
    case 'MAINTENANCE':
      return {
        type: 'MAINTENANCE',
        maintenanceType: candidate.maintenance.maintenanceType,
        affectedServers: [...candidate.maintenance.affectedServers],
        compensationSlug: links.compensationSlug,
      };
    case 'BANNER':
      return {
        type: 'BANNER',
        bannerType: candidate.banner.bannerType,
        phase: candidate.banner.phase,
        featured: candidate.banner.featured.map((featured) => ({ ...featured })),
      };
    case 'UPDATE':
      return { type: 'UPDATE' };
    case 'ANNOUNCEMENT':
      return { type: 'ANNOUNCEMENT' };
  }
}

export function sourceSummaryOf(
  source: Pick<SourceDefinition, 'id' | 'name' | 'type' | 'isOfficial' | 'attribution'>,
  url: string,
): SourceSummary {
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    isOfficial: source.isOfficial,
    url,
    attribution: source.attribution,
  };
}

/** Entity type of banner-featured units, derived from the banner type. */
export function featuredEntityType(bannerType: string): EntityType {
  if (bannerType === 'CHARACTER') return 'CHARACTER';
  if (bannerType === 'WEAPON') return 'WEAPON';
  return 'OTHER';
}

/** Normalizes any ISO-8601 instant (with offset) to canonical UTC "Z" form. */
export function toIso(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function toIsoOrNull(value: string | Date | null | undefined): string | null {
  return value === null || value === undefined ? null : toIso(value);
}
