/**
 * MapleStory KR: NEXON Open API notice adapter (research: docs/research/2026-10-02-maplestory.md).
 *
 *   GET /maplestory/v1/notice-event   → EVENT (official event window)
 *   GET /maplestory/v1/notice-update  → UPDATE (update notices; publication time only)
 *   GET /maplestory/v1/notice         → MAINTENANCE when the title says 점검, else ANNOUNCEMENT
 *
 * Held at PENDING_REVIEW: the terms require attribution, restrict storage (30-day TTL in the
 * English terms) and commercial use. Detail endpoints (article bodies) are not requested.
 */
import {
  sanitizePlainText,
  toSingleLine,
  type NormalizedCandidate,
  type SourceDefinition,
} from '@gamepulse/domain';
import { z } from 'zod';
import type { RateLimitPolicy } from '../../http/rate-limit';
import { parseSourceDateTime } from '../../normalize/time';
import { mockSourceFor } from '../../sources';
import {
  AdapterUnavailableError,
  type AdapterContext,
  type AdapterDefinition,
  type AdapterHealth,
  type DiscoveredResource,
  type FetchedDocument,
  type HealthCheck,
  type NormalizeResult,
  type SourceAdapter,
} from '../../types';
import { fetchJsonDocument, healthReport, isAllowedHost } from '../shared';

export const NEXON_API_BASE = 'https://open.api.nexon.com';
export const NEXON_ATTRIBUTION = 'Data based on NEXON Open API';
export const MAPLESTORY_NOTICE_PARSER = {
  id: 'maplestory-openapi',
  version: '1',
  kind: 'deterministic' as const,
};

export const MAPLESTORY_OPENAPI_SOURCE: SourceDefinition = {
  id: 'maplestory-openapi',
  gameId: 'maplestory',
  name: 'NEXON Open API (메이플스토리 공지)',
  type: 'OFFICIAL_API',
  isOfficial: true,
  homepageUrl: 'https://openapi.nexon.com/ko/game/maplestory/',
  allowedHosts: ['maplestory.nexon.com'],
  authentication: 'API_KEY',
  rateLimit:
    'Development key 5 req/s and 1,000 req/day; service key 500 req/s (no rate-limit headers)',
  contentTypes: ['EVENT', 'UPDATE', 'MAINTENANCE', 'ANNOUNCEMENT'],
  collectorStatus: 'PENDING_REVIEW',
  termsUrl: 'https://openapi.nexon.com/ko/support/terms/',
  termsReviewedAt: '2026-10-02',
  robotsPolicy: 'Official API only; maplestory.nexon.com pages are never fetched.',
  attribution: NEXON_ATTRIBUTION,
  dataRetentionDays: 30,
  notes:
    'Attribution required; storage and commercial use restricted (English terms: 30-day TTL, no advertising next to API data). Legal review required before enabling.',
};

const SOURCE_ZONE = 'Asia/Seoul';
const RATE_LIMIT: RateLimitPolicy = { limit: 2, intervalMs: 1000 };

const eventItem = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  notice_id: z.number().int(),
  date: z.string().nullish(),
  date_event_start: z.string().nullish(),
  date_event_end: z.string().nullish(),
});

type ResourceKind = 'event' | 'update' | 'notice';

const RESOURCES: ReadonlyArray<{ kind: ResourceKind; path: string; listKey: string }> = [
  { kind: 'event', path: '/maplestory/v1/notice-event', listKey: 'event_notice' },
  { kind: 'update', path: '/maplestory/v1/notice-update', listKey: 'update_notice' },
  { kind: 'notice', path: '/maplestory/v1/notice', listKey: 'notice' },
];

export class MapleStoryNoticeAdapter implements SourceAdapter {
  readonly id = 'maplestory-openapi';
  readonly gameId = 'maplestory';
  readonly source: SourceDefinition;

  constructor(private readonly context: AdapterContext) {
    this.source =
      context.mode === 'mock'
        ? mockSourceFor(MAPLESTORY_OPENAPI_SOURCE)
        : MAPLESTORY_OPENAPI_SOURCE;
  }

  get mode() {
    return this.context.mode;
  }

  private authHeaders(): Record<string, string> {
    if (this.context.mode !== 'live') return {};
    const key = this.context.credentials.NEXON_OPEN_API_KEY;
    if (!key) throw new AdapterUnavailableError('NEXON_OPEN_API_KEY is not configured');
    return { 'x-nxopen-api-key': key };
  }

  discover(): Promise<DiscoveredResource[]> {
    return Promise.resolve(
      RESOURCES.map((resource) => ({
        externalId: resource.kind,
        url: `${NEXON_API_BASE}${resource.path}`,
        hints: { resource: resource.kind, listKey: resource.listKey },
      })),
    );
  }

  async fetch(
    resource: DiscoveredResource,
    previous?: { etag: string | null; lastModified: string | null } | null,
  ): Promise<FetchedDocument> {
    const document = await fetchJsonDocument(this.context, this.source.id, resource, previous, {
      headers: this.authHeaders(),
      rateLimitKey: MAPLESTORY_OPENAPI_SOURCE.id,
      rateLimit: RATE_LIMIT,
      locale: 'ko-KR',
    });
    return document;
  }

  normalize(document: FetchedDocument): Promise<NormalizeResult> {
    const kind = document.externalId as ResourceKind | null;
    const spec = RESOURCES.find((resource) => resource.kind === kind);
    if (!spec) throw new Error(`Unknown MapleStory notice resource ${String(document.externalId)}`);
    const payload = JSON.parse(document.rawText) as unknown;
    const list =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)[spec.listKey]
        : undefined;
    if (!Array.isArray(list)) throw new Error(`${document.url}: "${spec.listKey}" list missing`);

    const warnings: string[] = [];
    const candidates: NormalizedCandidate[] = [];
    list.forEach((raw, index) => {
      const candidate = this.toCandidate(spec.kind, raw, index, warnings);
      if (candidate) candidates.push(candidate);
    });
    return Promise.resolve({
      candidates,
      parser: MAPLESTORY_NOTICE_PARSER,
      documentText: null,
      warnings,
    });
  }

  private toCandidate(
    kind: ResourceKind,
    raw: unknown,
    index: number,
    warnings: string[],
  ): NormalizedCandidate | null {
    // List items are event items without the event window, so one schema covers every list.
    const parsed = eventItem.safeParse(raw);
    if (!parsed.success) {
      warnings.push(`${kind}[${index}]: unexpected shape skipped`);
      return null;
    }
    const item = parsed.data;
    const url = item.url.trim();
    if (!/^https?:\/\//i.test(url) || !isAllowedHost(url, this.source.allowedHosts)) {
      warnings.push(`${kind}[${index}]: link outside allowed hosts skipped`);
      return null;
    }
    const title = toSingleLine(sanitizePlainText(item.title));
    const published = parseSourceDateTime(item.date, SOURCE_ZONE);
    const base = {
      gameId: this.gameId,
      sourceKey: `${kind}:${item.notice_id}`,
      slugHint: `${kind}-${item.notice_id}`,
      title,
      summary: null,
      sourceUrl: url,
      sourcePublishedAt: published?.iso ?? null,
      sourceLocale: 'ko-KR',
      confidence: 1,
      evidence: [],
      isSynthetic: this.context.mode !== 'live',
      metadata: null,
    };

    if (kind === 'event') {
      const start = parseSourceDateTime(item.date_event_start, SOURCE_ZONE);
      const end = parseSourceDateTime(item.date_event_end, SOURCE_ZONE);
      return {
        kind: 'EVENT',
        ...base,
        startAt: start?.iso ?? null,
        endAt: end?.iso ?? null,
        timing: {
          sourceTimezone: SOURCE_ZONE,
          startAtSource: start?.sourceText ?? null,
          endAtSource: end?.sourceText ?? null,
          region: 'kr',
          precision: 'DATETIME',
        },
        priority: 50,
        event: { eventType: 'OTHER', eligibility: null, rewardSummary: null, rewards: [] },
      };
    }
    const common = { ...base, startAt: null, endAt: null, timing: null };
    if (kind === 'update') return { kind: 'UPDATE', ...common, priority: 65 };
    if (title.includes('점검')) {
      return {
        kind: 'MAINTENANCE',
        ...common,
        priority: 75,
        maintenance: {
          maintenanceType: title.includes('긴급')
            ? 'EMERGENCY'
            : title.includes('연장')
              ? 'EXTENDED'
              : 'SCHEDULED',
          affectedServers: [],
          compensationSourceKey: null,
        },
      };
    }
    return { kind: 'ANNOUNCEMENT', ...common, priority: 40 };
  }

  async healthCheck(): Promise<AdapterHealth> {
    const now = this.context.clock();
    const checks: HealthCheck[] = [];
    if (this.context.mode === 'live' && !this.context.credentials.NEXON_OPEN_API_KEY) {
      checks.push({
        name: 'credentials',
        ok: false,
        detail: 'NEXON_OPEN_API_KEY is not configured',
      });
      return healthReport(this.id, checks, now, 'DISABLED');
    }
    try {
      const [resource] = await this.discover();
      if (!resource) throw new Error('no resources');
      const result = await this.normalize(await this.fetch(resource));
      checks.push({
        name: 'event notices endpoint',
        ok: true,
        detail: `${result.candidates.length} candidates, ${result.warnings.length} warnings`,
      });
    } catch (error) {
      checks.push({
        name: 'event notices endpoint',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return healthReport(this.id, checks, now);
  }
}

export const mapleStoryNoticeDefinition: AdapterDefinition = {
  id: 'maplestory-openapi',
  gameId: 'maplestory',
  source: MAPLESTORY_OPENAPI_SOURCE,
  description: 'NEXON Open API: MapleStory event, update and general notices',
  supportedModes: ['mock', 'live'],
  credentials: ['NEXON_OPEN_API_KEY'],
  scheduleEveryMinutes: 60,
  create: (context) => new MapleStoryNoticeAdapter(context),
};
