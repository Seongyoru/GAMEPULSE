/**
 * Read model returned by every ContentReadStore implementation (PostgreSQL and in-memory),
 * and the compact PulseItem projection sent to client components.
 */
import type {
  BannerType,
  ContentStatus,
  ContentType,
  EventType,
  MaintenanceType,
  PatchChangeType,
  EntityType,
  ProvenanceRole,
  RewardType,
  SourceType,
  ValidationStatus,
  VerificationState,
} from './enums';
import type { BannerFeatured, CandidateTiming, RewardItem } from './schemas/candidate';

export interface SourceSummary {
  id: string;
  name: string;
  type: SourceType;
  isOfficial: boolean;
  /** Item-level URL of the original source document. Always present: users must reach the origin. */
  url: string;
  /** Attribution text the source requires to be displayed (e.g. NEXON Open API). */
  attribution: string | null;
}

export interface ProvenanceEntry {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  sourceUrl: string;
  role: ProvenanceRole;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface PatchChangeRecord {
  targetType: EntityType;
  targetKey: string | null;
  targetName: string;
  changeType: PatchChangeType;
  field: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  unit: string | null;
  description: string | null;
}

export type ContentDetail =
  | { type: 'PATCH'; version: string; releaseAt: string | null; changes: PatchChangeRecord[] }
  | { type: 'UPDATE' }
  | {
      type: 'EVENT';
      eventType: EventType;
      eligibility: string | null;
      rewardSummary: string | null;
      rewards: RewardItem[];
    }
  | {
      type: 'REWARD';
      rewardType: RewardType;
      howToClaim: string | null;
      items: RewardItem[];
      relatedSlug: string | null;
    }
  | { type: 'REDEEM_CODE'; code: string; region: string | null; items: RewardItem[] }
  | {
      type: 'MAINTENANCE';
      maintenanceType: MaintenanceType;
      affectedServers: string[];
      compensationSlug: string | null;
    }
  | { type: 'BANNER'; bannerType: BannerType; phase: number | null; featured: BannerFeatured[] }
  | { type: 'ANNOUNCEMENT' };

export interface ContentRecord {
  id: string;
  slug: string;
  gameId: string;
  type: ContentType;
  title: string;
  summary: string | null;
  startAt: string | null;
  endAt: string | null;
  timing: CandidateTiming | null;
  /** When GAMEPULSE first published the record. */
  publishedAt: string;
  /** Publication time stated by the official source, when known. */
  sourcePublishedAt: string | null;
  updatedAt: string;
  /** Last time any source confirmed the record. */
  lastSeenAt: string;
  priority: number;
  status: ContentStatus;
  verification: VerificationState;
  verifiedAt: string | null;
  validationStatus: ValidationStatus;
  confidence: number;
  isSynthetic: boolean;
  sourceLocale: string;
  parser: { id: string; version: string };
  source: SourceSummary;
  provenance: ProvenanceEntry[];
  detail: ContentDetail;
}

export type DetailOf<T extends ContentType> = Extract<ContentDetail, { type: T }>;

/** URL families. Every content type maps to exactly one canonical family. */
export const CONTENT_ROUTE_FAMILIES = ['patches', 'events', 'rewards', 'notices'] as const;
export type ContentRouteFamily = (typeof CONTENT_ROUTE_FAMILIES)[number];

const ROUTE_FAMILY_BY_TYPE: Readonly<Record<ContentType, ContentRouteFamily>> = {
  PATCH: 'patches',
  UPDATE: 'patches',
  EVENT: 'events',
  BANNER: 'events',
  REWARD: 'rewards',
  REDEEM_CODE: 'rewards',
  MAINTENANCE: 'notices',
  ANNOUNCEMENT: 'notices',
};

export function routeFamilyForType(type: ContentType): ContentRouteFamily {
  return ROUTE_FAMILY_BY_TYPE[type];
}

export function typesForRouteFamily(family: ContentRouteFamily): ContentType[] {
  return (Object.keys(ROUTE_FAMILY_BY_TYPE) as ContentType[]).filter(
    (type) => ROUTE_FAMILY_BY_TYPE[type] === family,
  );
}

/** Canonical, locale-independent path of a content record. */
export function contentPath(record: { type: ContentType; slug: string }): string {
  return `/${routeFamilyForType(record.type)}/${record.slug}`;
}

/** Small typed facts used by compact cards. */
export interface PulseFacts {
  version?: string;
  changeCount?: number;
  changeHighlights?: string[];
  rewardItems?: RewardItem[];
  code?: string;
  featured?: string[];
  eventType?: EventType;
  maintenanceType?: MaintenanceType;
  bannerType?: BannerType;
  rewardType?: RewardType;
}

/** Compact, serializable projection used by client components (TODAY, calendar, lists). */
export interface PulseItem {
  id: string;
  slug: string;
  href: string;
  gameId: string;
  type: ContentType;
  title: string;
  summary: string | null;
  startAt: string | null;
  endAt: string | null;
  publishedAt: string;
  sourcePublishedAt: string | null;
  updatedAt: string;
  priority: number;
  verification: VerificationState;
  isSynthetic: boolean;
  sourceName: string;
  sourceType: SourceType;
  sourceUrl: string;
  facts: PulseFacts;
}

function describeChange(change: PatchChangeRecord): string {
  const field = change.field ? ` ${change.field}` : '';
  if (change.beforeValue !== null && change.afterValue !== null) {
    return `${change.targetName}${field} ${change.beforeValue} → ${change.afterValue}`;
  }
  return `${change.targetName}${field}`;
}

export function pulseFactsFor(detail: ContentDetail): PulseFacts {
  switch (detail.type) {
    case 'PATCH':
      return {
        version: detail.version,
        changeCount: detail.changes.length,
        changeHighlights: detail.changes.slice(0, 3).map(describeChange),
      };
    case 'EVENT':
      return { eventType: detail.eventType, rewardItems: detail.rewards.slice(0, 4) };
    case 'REWARD':
      return { rewardType: detail.rewardType, rewardItems: detail.items.slice(0, 4) };
    case 'REDEEM_CODE':
      return { code: detail.code, rewardItems: detail.items.slice(0, 4) };
    case 'MAINTENANCE':
      return { maintenanceType: detail.maintenanceType };
    case 'BANNER':
      return { bannerType: detail.bannerType, featured: detail.featured.map((f) => f.name) };
    case 'UPDATE':
    case 'ANNOUNCEMENT':
      return {};
  }
}

export function toPulseItem(record: ContentRecord): PulseItem {
  return {
    id: record.id,
    slug: record.slug,
    href: contentPath(record),
    gameId: record.gameId,
    type: record.type,
    title: record.title,
    summary: record.summary,
    startAt: record.startAt,
    endAt: record.endAt,
    publishedAt: record.publishedAt,
    sourcePublishedAt: record.sourcePublishedAt,
    updatedAt: record.updatedAt,
    priority: record.priority,
    verification: record.verification,
    isSynthetic: record.isSynthetic,
    sourceName: record.source.name,
    sourceType: record.source.type,
    sourceUrl: record.source.url,
    facts: pulseFactsFor(record.detail),
  };
}
