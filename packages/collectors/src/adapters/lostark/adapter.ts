/**
 * Lost Ark KR Open API adapter.
 *
 *   GET /news/events                → EVENT (+ REWARD when the API states a reward claim deadline)
 *   GET /news/notices?type=점검      → MAINTENANCE (window unknown: only title/date are in the API)
 *   GET /news/notices?type=공지      → ANNOUNCEMENT
 *
 * Every field comes from the API response; unknown values stay null. Offset-less times are
 * Korean service times (source policy). Thumbnails (publisher artwork) are never stored.
 */
import {
  sanitizePlainText,
  toSingleLine,
  type CandidateOf,
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
import {
  contentFingerprint,
  fetchJsonDocument,
  healthReport,
  isAllowedHost,
  trailingNumericId,
} from '../shared';
import { LOSTARK_OPENAPI_SOURCE } from './source';

export const LOSTARK_API_BASE = 'https://developer-lostark.game.onstove.com';
export const LOSTARK_PARSER = {
  id: 'lostark-openapi',
  version: '1',
  kind: 'deterministic' as const,
};

const SOURCE_ZONE = 'Asia/Seoul';
const REGION = 'kr';
const RATE_LIMIT: RateLimitPolicy = { limit: 90, intervalMs: 60_000 };

const eventSchema = z.object({
  Title: z.string().min(1),
  Link: z.string().min(1),
  StartDate: z.string().nullish(),
  EndDate: z.string().nullish(),
  RewardDate: z.string().nullish(),
});

const noticeSchema = z.object({
  Title: z.string().min(1),
  Date: z.string().nullish(),
  Link: z.string().min(1),
  Type: z.string().min(1),
});

type ResourceKind = 'events' | 'notices-maintenance' | 'notices-general';

const RESOURCES: ReadonlyArray<{ kind: ResourceKind; path: string }> = [
  { kind: 'events', path: '/news/events' },
  { kind: 'notices-maintenance', path: `/news/notices?type=${encodeURIComponent('점검')}` },
  { kind: 'notices-general', path: `/news/notices?type=${encodeURIComponent('공지')}` },
];

function cleanTitle(value: string): string {
  return toSingleLine(sanitizePlainText(value));
}

/** Stable identity: the article number in the official link, else a content fingerprint. */
function identity(prefix: string, link: string, ...fingerprint: Array<string | null>) {
  const id = trailingNumericId(link, /\/(\d+)\/?$/);
  return id
    ? { sourceKey: `${prefix}:${id}`, slugHint: `${prefix}-${id}` }
    : { sourceKey: `${prefix}:${contentFingerprint(...fingerprint)}`, slugHint: null };
}

function maintenanceType(
  title: string,
): CandidateOf<'MAINTENANCE'>['maintenance']['maintenanceType'] {
  if (title.includes('긴급')) return 'EMERGENCY';
  if (title.includes('연장')) return 'EXTENDED';
  return 'SCHEDULED';
}

export class LostArkOpenApiAdapter implements SourceAdapter {
  readonly id = 'lostark-openapi';
  readonly gameId = 'lostark';
  readonly source: SourceDefinition;

  constructor(private readonly context: AdapterContext) {
    this.source =
      context.mode === 'mock' ? mockSourceFor(LOSTARK_OPENAPI_SOURCE) : LOSTARK_OPENAPI_SOURCE;
  }

  get mode() {
    return this.context.mode;
  }

  private authHeaders(): Record<string, string> {
    if (this.context.mode !== 'live') return {};
    const key = this.context.credentials.LOSTARK_API_KEY;
    if (!key) throw new AdapterUnavailableError('LOSTARK_API_KEY is not configured');
    return { authorization: `bearer ${key}` };
  }

  discover(): Promise<DiscoveredResource[]> {
    return Promise.resolve(
      RESOURCES.map((resource) => ({
        externalId: resource.kind,
        url: `${LOSTARK_API_BASE}${resource.path}`,
        hints: { resource: resource.kind },
      })),
    );
  }

  async fetch(
    resource: DiscoveredResource,
    previous?: { etag: string | null; lastModified: string | null } | null,
  ): Promise<FetchedDocument> {
    const document = await fetchJsonDocument(this.context, this.source.id, resource, previous, {
      headers: this.authHeaders(),
      rateLimitKey: LOSTARK_OPENAPI_SOURCE.id,
      rateLimit: RATE_LIMIT,
      locale: 'ko-KR',
    });
    return document;
  }

  normalize(document: FetchedDocument): Promise<NormalizeResult> {
    const warnings: string[] = [];
    let payload: unknown;
    try {
      payload = JSON.parse(document.rawText);
    } catch {
      throw new Error(`${document.url} did not return JSON`);
    }
    if (!Array.isArray(payload)) throw new Error(`${document.url} did not return a JSON array`);

    const kind = document.externalId as ResourceKind | null;
    const candidates: NormalizedCandidate[] = [];
    payload.forEach((raw, index) => {
      const produced =
        kind === 'events'
          ? this.fromEvent(raw, index, warnings)
          : this.fromNotice(raw, index, warnings);
      candidates.push(...produced);
    });
    return Promise.resolve({
      candidates,
      parser: LOSTARK_PARSER,
      documentText: null,
      warnings,
    });
  }

  private base(link: string, title: string) {
    return {
      gameId: this.gameId,
      title,
      summary: null,
      sourceUrl: link,
      sourceLocale: 'ko-KR',
      confidence: 1,
      evidence: [],
      // Mock mode replays development data under a fixture twin source: always synthetic.
      isSynthetic: this.context.mode !== 'live',
      metadata: null,
    };
  }

  private linkOrWarn(link: string, index: number, warnings: string[]): string | null {
    const url = link.trim();
    if (!/^https?:\/\//i.test(url) || !isAllowedHost(url, this.source.allowedHosts)) {
      warnings.push(`item ${index}: link outside allowed hosts skipped (${url.slice(0, 80)})`);
      return null;
    }
    return url;
  }

  private fromEvent(raw: unknown, index: number, warnings: string[]): NormalizedCandidate[] {
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) {
      warnings.push(`events[${index}]: unexpected shape skipped`);
      return [];
    }
    const item = parsed.data;
    const link = this.linkOrWarn(item.Link, index, warnings);
    if (!link) return [];
    const title = cleanTitle(item.Title);
    const start = parseSourceDateTime(item.StartDate, SOURCE_ZONE);
    const end = parseSourceDateTime(item.EndDate, SOURCE_ZONE);
    const { sourceKey, slugHint } = identity('event', link, item.Title, item.StartDate ?? null);

    const event: CandidateOf<'EVENT'> = {
      kind: 'EVENT',
      ...this.base(link, title),
      sourceKey,
      slugHint,
      startAt: start?.iso ?? null,
      endAt: end?.iso ?? null,
      timing: {
        sourceTimezone: SOURCE_ZONE,
        startAtSource: start?.sourceText ?? null,
        endAtSource: end?.sourceText ?? null,
        region: REGION,
        precision: 'DATETIME',
      },
      sourcePublishedAt: null,
      priority: 50,
      event: { eventType: 'OTHER', eligibility: null, rewardSummary: null, rewards: [] },
    };

    const rewardDeadline = parseSourceDateTime(item.RewardDate, SOURCE_ZONE);
    if (!rewardDeadline) return [event];
    // "RewardDate" (보상 수령 기간) is the official claim deadline of the event's rewards.
    const reward: CandidateOf<'REWARD'> = {
      kind: 'REWARD',
      ...this.base(link, `${title} 보상 수령`),
      sourceKey: `${sourceKey}#reward`,
      slugHint: slugHint ? `${slugHint}-reward` : null,
      startAt: start?.iso ?? null,
      endAt: rewardDeadline.iso,
      timing: {
        sourceTimezone: SOURCE_ZONE,
        startAtSource: start?.sourceText ?? null,
        endAtSource: rewardDeadline.sourceText,
        region: REGION,
        precision: 'DATETIME',
      },
      sourcePublishedAt: null,
      priority: 55,
      reward: { rewardType: 'EVENT', howToClaim: null, items: [], relatedSourceKey: sourceKey },
    };
    return [event, reward];
  }

  private fromNotice(raw: unknown, index: number, warnings: string[]): NormalizedCandidate[] {
    const parsed = noticeSchema.safeParse(raw);
    if (!parsed.success) {
      warnings.push(`notices[${index}]: unexpected shape skipped`);
      return [];
    }
    const item = parsed.data;
    if (item.Type !== '점검' && item.Type !== '공지') return [];
    const link = this.linkOrWarn(item.Link, index, warnings);
    if (!link) return [];
    const title = cleanTitle(item.Title);
    const published = parseSourceDateTime(item.Date, SOURCE_ZONE);
    const { sourceKey, slugHint } = identity('notice', link, item.Title, item.Date ?? null);
    const common = {
      ...this.base(link, title),
      sourceKey,
      slugHint,
      startAt: null,
      endAt: null,
      timing: null,
      sourcePublishedAt: published?.iso ?? null,
    };
    if (item.Type === '점검') {
      // The API lists maintenance notices but not their window; times stay unknown (null).
      return [
        {
          kind: 'MAINTENANCE',
          ...common,
          priority: 75,
          maintenance: {
            maintenanceType: maintenanceType(title),
            affectedServers: [],
            compensationSourceKey: null,
          },
        },
      ];
    }
    return [{ kind: 'ANNOUNCEMENT', ...common, priority: 40 }];
  }

  async healthCheck(): Promise<AdapterHealth> {
    const now = this.context.clock();
    const checks: HealthCheck[] = [];
    if (this.context.mode === 'live' && !this.context.credentials.LOSTARK_API_KEY) {
      checks.push({ name: 'credentials', ok: false, detail: 'LOSTARK_API_KEY is not configured' });
      return healthReport(this.id, checks, now, 'DISABLED');
    }
    try {
      const [resource] = await this.discover();
      if (!resource) throw new Error('no resources');
      const document = await this.fetch(resource);
      const result = await this.normalize(document);
      checks.push({
        name: 'events endpoint',
        ok: true,
        detail: `HTTP ${document.httpStatus ?? '?'}, ${result.candidates.length} candidates, ${result.warnings.length} warnings`,
      });
    } catch (error) {
      checks.push({
        name: 'events endpoint',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    if (LOSTARK_OPENAPI_SOURCE.collectorStatus !== 'ENABLED') {
      checks.push({
        name: 'collection policy',
        ok: true,
        detail: `source is ${LOSTARK_OPENAPI_SOURCE.collectorStatus}: health check only, nothing is stored`,
      });
    }
    return healthReport(this.id, checks, now);
  }
}

export const lostArkOpenApiDefinition: AdapterDefinition = {
  id: 'lostark-openapi',
  gameId: 'lostark',
  source: LOSTARK_OPENAPI_SOURCE,
  description: 'Lost Ark KR Open API: events, reward claim deadlines, maintenance and notices',
  supportedModes: ['mock', 'live'],
  credentials: ['LOSTARK_API_KEY'],
  scheduleEveryMinutes: 60,
  create: (context) => new LostArkOpenApiAdapter(context),
};
