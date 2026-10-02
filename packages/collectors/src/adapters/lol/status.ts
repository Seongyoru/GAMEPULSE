/**
 * League of Legends: lol-status-v4 adapter (Riot Developer API, KR platform).
 *
 *   GET https://kr.api.riotgames.com/lol/status/v4/platform-data
 *     maintenances[] → MAINTENANCE   incidents[] (warning/critical) → ANNOUNCEMENT
 *
 * The DTO has no structured maintenance window, so times stay null; the short status title
 * and the latest update line (Korean) are kept, with Riot's status page as the source link.
 * Held at PENDING_REVIEW: public products need a registered product and a production key.
 */
import {
  sanitizePlainText,
  toSingleLine,
  truncateText,
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
import { fetchJsonDocument, healthReport } from '../shared';

export const LOL_STATUS_URL = 'https://kr.api.riotgames.com/lol/status/v4/platform-data';
export const LOL_STATUS_PAGE = 'https://status.riotgames.com/lol?region=kr&locale=ko_KR';
export const LOL_STATUS_PARSER = {
  id: 'lol-status-v4',
  version: '1',
  kind: 'deterministic' as const,
};

export const LOL_STATUS_SOURCE: SourceDefinition = {
  id: 'lol-status',
  gameId: 'lol',
  name: 'Riot lol-status-v4 (KR)',
  type: 'OFFICIAL_API',
  isOfficial: true,
  homepageUrl: 'https://developer.riotgames.com/apis#lol-status-v4',
  allowedHosts: ['status.riotgames.com'],
  authentication: 'API_KEY',
  rateLimit: 'Personal key 20 req/1 s and 100 req/2 min; production keys start at 500 req/10 s',
  contentTypes: ['MAINTENANCE', 'ANNOUNCEMENT'],
  collectorStatus: 'PENDING_REVIEW',
  termsUrl: 'https://developer.riotgames.com/policies/general',
  termsReviewedAt: '2026-10-02',
  robotsPolicy:
    'Official API only; Riot websites are never fetched (Riot ToS forbids bots on Riot Services).',
  attribution: null,
  dataRetentionDays: null,
  notes:
    'Development keys expire every 24 h and may not power a public product: enable after product registration and a production key.',
};

const LOCALES = ['ko_KR', 'en_US'] as const;
const RATE_LIMIT: RateLimitPolicy = { limit: 10, intervalMs: 1000 };
const SUMMARY_LENGTH = 200;

const contentSchema = z.object({ locale: z.string(), content: z.string() });
const statusSchema = z.object({
  id: z.number().int(),
  maintenance_status: z.string().nullish(),
  incident_severity: z.string().nullish(),
  titles: z.array(contentSchema).default([]),
  updates: z
    .array(
      z.object({
        translations: z.array(contentSchema).default([]),
        created_at: z.string().nullish(),
        updated_at: z.string().nullish(),
      }),
    )
    .default([]),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
});
// Riot omits empty values, so every list may be missing.
const platformSchema = z.object({
  maintenances: z.array(z.unknown()).default([]),
  incidents: z.array(z.unknown()).default([]),
});

type Status = z.infer<typeof statusSchema>;

function localized(entries: ReadonlyArray<{ locale: string; content: string }>): string | null {
  for (const locale of LOCALES) {
    const match = entries.find((entry) => entry.locale === locale && entry.content.trim() !== '');
    if (match) return toSingleLine(sanitizePlainText(match.content));
  }
  return null;
}

export class LolStatusAdapter implements SourceAdapter {
  readonly id = 'lol-status';
  readonly gameId = 'lol';
  readonly source: SourceDefinition;

  constructor(private readonly context: AdapterContext) {
    this.source = context.mode === 'mock' ? mockSourceFor(LOL_STATUS_SOURCE) : LOL_STATUS_SOURCE;
  }

  get mode() {
    return this.context.mode;
  }

  private authHeaders(): Record<string, string> {
    if (this.context.mode !== 'live') return {};
    const key = this.context.credentials.RIOT_API_KEY;
    if (!key) throw new AdapterUnavailableError('RIOT_API_KEY is not configured');
    return { 'x-riot-token': key };
  }

  discover(): Promise<DiscoveredResource[]> {
    return Promise.resolve([{ externalId: 'platform-data-kr', url: LOL_STATUS_URL }]);
  }

  async fetch(
    resource: DiscoveredResource,
    previous?: { etag: string | null; lastModified: string | null } | null,
  ): Promise<FetchedDocument> {
    const document = await fetchJsonDocument(this.context, this.source.id, resource, previous, {
      headers: this.authHeaders(),
      rateLimitKey: LOL_STATUS_SOURCE.id,
      rateLimit: RATE_LIMIT,
      locale: 'ko-KR',
    });
    return document;
  }

  normalize(document: FetchedDocument): Promise<NormalizeResult> {
    const platform = platformSchema.parse(JSON.parse(document.rawText));
    const warnings: string[] = [];
    const candidates: NormalizedCandidate[] = [];
    const parse = (raw: unknown, label: string): Status | null => {
      const parsed = statusSchema.safeParse(raw);
      if (!parsed.success) warnings.push(`${label}: unexpected shape skipped`);
      return parsed.success ? parsed.data : null;
    };
    platform.maintenances.forEach((raw, index) => {
      const status = parse(raw, `maintenances[${index}]`);
      if (status) this.push(candidates, warnings, status, 'MAINTENANCE');
    });
    platform.incidents.forEach((raw, index) => {
      const status = parse(raw, `incidents[${index}]`);
      // "info" incidents are minor notes; warning/critical ones affect players.
      if (status && status.incident_severity !== 'info')
        this.push(candidates, warnings, status, 'ANNOUNCEMENT');
    });
    return Promise.resolve({ candidates, parser: LOL_STATUS_PARSER, documentText: null, warnings });
  }

  private push(
    candidates: NormalizedCandidate[],
    warnings: string[],
    status: Status,
    kind: 'MAINTENANCE' | 'ANNOUNCEMENT',
  ): void {
    const title = localized(status.titles);
    if (!title) {
      warnings.push(`status ${status.id}: no Korean or English title`);
      return;
    }
    const latest = [...status.updates].sort((a, b) =>
      (b.updated_at ?? b.created_at ?? '').localeCompare(a.updated_at ?? a.created_at ?? ''),
    )[0];
    const update = latest ? localized(latest.translations) : null;
    const published = parseSourceDateTime(status.created_at, 'UTC');
    const base = {
      gameId: this.gameId,
      sourceKey: `${kind === 'MAINTENANCE' ? 'maintenance' : 'incident'}:${status.id}`,
      slugHint: `${kind === 'MAINTENANCE' ? 'status-maintenance' : 'status-incident'}-${status.id}`,
      title: truncateText(title, 200),
      summary: update ? truncateText(update, SUMMARY_LENGTH) : null,
      startAt: null,
      endAt: null,
      timing: null,
      sourceUrl: LOL_STATUS_PAGE,
      sourcePublishedAt: published?.iso ?? null,
      sourceLocale: 'ko-KR',
      confidence: 1,
      evidence: [],
      isSynthetic: this.context.mode !== 'live',
      metadata: {
        maintenanceStatus: status.maintenance_status ?? null,
        incidentSeverity: status.incident_severity ?? null,
      },
    };
    if (kind === 'MAINTENANCE') {
      candidates.push({
        kind,
        ...base,
        priority: 75,
        maintenance: {
          maintenanceType: 'SCHEDULED',
          affectedServers: [],
          compensationSourceKey: null,
        },
      });
    } else {
      candidates.push({
        kind,
        ...base,
        priority: status.incident_severity === 'critical' ? 85 : 60,
      });
    }
  }

  async healthCheck(): Promise<AdapterHealth> {
    const now = this.context.clock();
    const checks: HealthCheck[] = [];
    if (this.context.mode === 'live' && !this.context.credentials.RIOT_API_KEY) {
      checks.push({ name: 'credentials', ok: false, detail: 'RIOT_API_KEY is not configured' });
      return healthReport(this.id, checks, now, 'DISABLED');
    }
    try {
      const [resource] = await this.discover();
      if (!resource) throw new Error('no resources');
      const result = await this.normalize(await this.fetch(resource));
      checks.push({
        name: 'platform-data',
        ok: true,
        detail: `${result.candidates.length} active statuses`,
      });
    } catch (error) {
      checks.push({
        name: 'platform-data',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return healthReport(this.id, checks, now);
  }
}

export const lolStatusDefinition: AdapterDefinition = {
  id: 'lol-status',
  gameId: 'lol',
  source: LOL_STATUS_SOURCE,
  description: 'Riot lol-status-v4 (KR): maintenance and player-affecting incidents',
  supportedModes: ['mock', 'live'],
  credentials: ['RIOT_API_KEY'],
  scheduleEveryMinutes: 15,
  create: (context) => new LolStatusAdapter(context),
};
