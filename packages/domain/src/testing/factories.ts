/**
 * Test data factories shared across packages (`@gamepulse/domain/testing`).
 * Produces valid, clearly synthetic objects with overridable fields.
 */
import {
  contentPath,
  pulseFactsFor,
  type ContentDetail,
  type ContentRecord,
  type PulseItem,
} from '../content';
import type { ContentType } from '../enums';
import type { CandidateKind, CandidateOf, NormalizedCandidate } from '../schemas/candidate';
import type { ResetRuleDefinition } from '../schemas/reset';
import type { SourceDefinition } from '../schemas/source';

export const TEST_NOW = new Date('2026-10-02T03:00:00.000Z');

export function hoursFrom(base: Date, hours: number): string {
  return new Date(base.getTime() + hours * 3_600_000).toISOString();
}

function defaultDetail(type: ContentType): ContentDetail {
  switch (type) {
    case 'PATCH':
      return { type, version: '1.0', releaseAt: null, changes: [] };
    case 'EVENT':
      return { type, eventType: 'IN_GAME', eligibility: null, rewardSummary: null, rewards: [] };
    case 'REWARD':
      return { type, rewardType: 'EVENT', howToClaim: null, items: [], relatedSlug: null };
    case 'REDEEM_CODE':
      return { type, code: 'GPTEST-SAMPLE-01', region: null, items: [] };
    case 'MAINTENANCE':
      return { type, maintenanceType: 'SCHEDULED', affectedServers: [], compensationSlug: null };
    case 'BANNER':
      return { type, bannerType: 'CHARACTER', phase: 1, featured: [] };
    case 'UPDATE':
    case 'ANNOUNCEMENT':
      return { type };
  }
}

let sequence = 0;

export function makeContentRecord(
  overrides: Partial<ContentRecord> & { type?: ContentType } = {},
): ContentRecord {
  sequence += 1;
  const type = overrides.type ?? 'EVENT';
  const id = overrides.id ?? `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
  const slug = overrides.slug ?? `test-${type.toLowerCase().replace('_', '-')}-${sequence}`;
  return {
    id,
    slug,
    gameId: 'genshin',
    type,
    title: `Synthetic ${type} ${sequence}`,
    summary: null,
    startAt: null,
    endAt: null,
    timing: null,
    publishedAt: TEST_NOW.toISOString(),
    sourcePublishedAt: null,
    updatedAt: TEST_NOW.toISOString(),
    lastSeenAt: TEST_NOW.toISOString(),
    priority: 50,
    status: 'PUBLISHED',
    verification: 'UNVERIFIED',
    verifiedAt: null,
    validationStatus: 'VALID',
    confidence: 1,
    isSynthetic: true,
    sourceLocale: 'ko-KR',
    parser: { id: 'fixture', version: 'test' },
    source: {
      id: 'genshin-fixture',
      name: 'GAMEPULSE Fixtures',
      type: 'FIXTURE',
      isOfficial: false,
      url: 'https://genshin.hoyoverse.com/ko/news',
      attribution: null,
    },
    provenance: [],
    detail: overrides.detail ?? defaultDetail(type),
    ...overrides,
  };
}

export function makePulseItem(
  overrides: Partial<PulseItem> & { type?: ContentType } = {},
): PulseItem {
  const type = overrides.type ?? 'EVENT';
  const record = makeContentRecord({ type });
  return {
    id: record.id,
    slug: record.slug,
    href: contentPath(record),
    gameId: record.gameId,
    type,
    title: record.title,
    summary: null,
    startAt: null,
    endAt: null,
    timePrecision: 'DATETIME',
    publishedAt: record.publishedAt,
    sourcePublishedAt: null,
    updatedAt: record.updatedAt,
    priority: 50,
    verification: 'UNVERIFIED',
    isSynthetic: true,
    sourceName: record.source.name,
    sourceType: record.source.type,
    sourceUrl: record.source.url,
    sourceAttribution: record.source.attribution,
    facts: pulseFactsFor(record.detail),
    ...overrides,
  };
}

export function makeResetRule(overrides: Partial<ResetRuleDefinition> = {}): ResetRuleDefinition {
  return {
    id: 'test-weekly-reset',
    gameId: 'lostark',
    name: '주간 초기화',
    frequency: 'WEEKLY',
    timezone: 'Asia/Seoul',
    hour: 6,
    minute: 0,
    dayOfWeek: 3,
    dayOfMonth: null,
    rrule: null,
    anchor: null,
    region: null,
    isPrimary: true,
    verification: 'UNVERIFIED',
    isSynthetic: true,
    sourceUrl: null,
    notes: null,
    ...overrides,
  };
}

export function makeSource(overrides: Partial<SourceDefinition> = {}): SourceDefinition {
  return {
    id: 'genshin-fixture',
    gameId: 'genshin',
    name: 'GAMEPULSE Fixtures',
    type: 'FIXTURE',
    isOfficial: false,
    homepageUrl: 'https://genshin.hoyoverse.com/ko/news',
    allowedHosts: ['genshin.hoyoverse.com'],
    authentication: 'NOT_APPLICABLE',
    rateLimit: null,
    contentTypes: [
      'PATCH',
      'UPDATE',
      'EVENT',
      'REWARD',
      'REDEEM_CODE',
      'MAINTENANCE',
      'BANNER',
      'ANNOUNCEMENT',
    ],
    collectorStatus: 'FIXTURE_ONLY',
    termsUrl: null,
    termsReviewedAt: null,
    robotsPolicy: null,
    attribution: null,
    dataRetentionDays: null,
    notes: null,
    ...overrides,
  };
}

type CandidateBase = Omit<CandidateOf<'ANNOUNCEMENT'>, 'kind'>;

function baseCandidate(sourceKey: string, title: string): CandidateBase {
  return {
    gameId: 'genshin',
    sourceKey,
    slugHint: null,
    title,
    summary: null,
    startAt: null,
    endAt: null,
    timing: null,
    sourceUrl: 'https://genshin.hoyoverse.com/ko/news',
    sourcePublishedAt: null,
    sourceLocale: 'ko-KR',
    priority: 50,
    confidence: 1,
    evidence: [],
    isSynthetic: true,
    metadata: null,
  };
}

function defaultCandidate(kind: CandidateKind, base: CandidateBase): NormalizedCandidate {
  switch (kind) {
    case 'PATCH':
      return { ...base, kind, patch: { version: '6.1', releaseAt: null, changes: [] } };
    case 'EVENT':
      return {
        ...base,
        kind,
        event: { eventType: 'IN_GAME', eligibility: null, rewardSummary: null, rewards: [] },
      };
    case 'REWARD':
      return {
        ...base,
        kind,
        reward: { rewardType: 'EVENT', howToClaim: null, items: [], relatedSourceKey: null },
      };
    case 'REDEEM_CODE':
      return { ...base, kind, redeemCode: { code: 'GPTEST-SAMPLE-01', region: null, items: [] } };
    case 'MAINTENANCE':
      return {
        ...base,
        kind,
        maintenance: {
          maintenanceType: 'SCHEDULED',
          affectedServers: [],
          compensationSourceKey: null,
        },
      };
    case 'BANNER':
      return { ...base, kind, banner: { bannerType: 'CHARACTER', phase: 1, featured: [] } };
    case 'UPDATE':
    case 'ANNOUNCEMENT':
      return { ...base, kind };
  }
}

export function makeCandidate<K extends CandidateKind>(
  kind: K,
  overrides: Partial<CandidateOf<K>> = {},
): CandidateOf<K> {
  const base = baseCandidate(
    overrides.sourceKey ?? `test-${kind.toLowerCase()}-1`,
    overrides.title ?? `Synthetic ${kind}`,
  );
  return { ...defaultCandidate(kind, base), ...overrides } as CandidateOf<K>;
}
