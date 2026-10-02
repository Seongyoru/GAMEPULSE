/**
 * League of Legends: Riot Data Dragon adapter (official static game data, no API key).
 *
 * Each run reads the KR realm file to learn the live data version, then — only when that
 * version is new (conditional request on its champion file) — downloads champion and item
 * data for it and for the previous version and publishes one PATCH record with the structured
 * numeric differences. Records are labelled with the Data Dragon version: the mapping to Riot
 * patch numbers is not documented, so it is never inferred.
 */
import { stableStringify, type CandidateOf, type SourceDefinition } from '@gamepulse/domain';
import { z } from 'zod';
import type { RateLimitPolicy } from '../../http/rate-limit';
import { mockSourceFor } from '../../sources';
import type {
  AdapterContext,
  AdapterDefinition,
  AdapterHealth,
  DiscoveredResource,
  FetchedDocument,
  NormalizeResult,
  SourceAdapter,
} from '../../types';
import { healthReport } from '../shared';
import { diffSnapshots, extractSnapshot, type DDragonSnapshot } from './ddragon-diff';

export const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';
export const DDRAGON_PARSER = {
  id: 'lol-ddragon-diff',
  version: '1',
  kind: 'deterministic' as const,
};

export const LOL_DDRAGON_SOURCE: SourceDefinition = {
  id: 'lol-ddragon',
  gameId: 'lol',
  name: 'Riot Data Dragon',
  type: 'OFFICIAL_API',
  isOfficial: true,
  homepageUrl: 'https://developer.riotgames.com/docs/lol#data-dragon',
  allowedHosts: ['ddragon.leagueoflegends.com'],
  authentication: 'NONE',
  rateLimit: 'No documented limit; GAMEPULSE sends at most 1 request/s with conditional requests',
  contentTypes: ['PATCH'],
  collectorStatus: 'ENABLED',
  termsUrl: 'https://developer.riotgames.com/policies/general',
  termsReviewedAt: '2026-10-02',
  robotsPolicy: 'Official static-data CDN published for developers; no website pages are fetched.',
  attribution: null,
  dataRetentionDays: null,
  notes:
    'Labelled with Data Dragon versions; the mapping to Riot patch numbers is undocumented and never inferred. attackdamageperlevel is ignored (published as 0 for every champion). Public launch requires Riot product registration (docs/LEGAL_NOTES.md).',
};

const LOCALE = 'ko_KR';
const RATE_LIMIT: RateLimitPolicy = { limit: 1, intervalMs: 1000, minIntervalMs: 1000 };
const MAX_CHANGES = 500;
const DOCUMENT_FORMAT = 'gamepulse-ddragon-v1';

const SEMVER = /^\d+\.\d+\.\d+$/;
const realmSchema = z.object({
  n: z.object({ champion: z.string().regex(SEMVER), item: z.string().regex(SEMVER) }),
});
const versionsSchema = z.array(z.string());
const hintsSchema = z.object({
  version: z.string().regex(SEMVER),
  itemVersion: z.string().regex(SEMVER),
  previousVersion: z.string().regex(SEMVER),
});

const snapshotSchema: z.ZodType<DDragonSnapshot> = z.object({
  version: z.string(),
  champions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      stats: z.record(z.string(), z.number()),
      spells: z.array(
        z.object({
          key: z.enum(['Q', 'W', 'E', 'R']),
          name: z.string(),
          cooldown: z.array(z.number()),
          cost: z.array(z.number()),
          range: z.array(z.number()),
        }),
      ),
    }),
  ),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      gold: z.number(),
      stats: z.record(z.string(), z.number()),
    }),
  ),
});

const documentSchema = z.object({
  format: z.literal(DOCUMENT_FORMAT),
  version: z.string(),
  previousVersion: z.string(),
  sourceLastModified: z.string().nullable(),
  current: snapshotSchema,
  previous: snapshotSchema,
});

export const championFileUrl = (version: string) =>
  `${DDRAGON_BASE}/cdn/${version}/data/${LOCALE}/championFull.json`;
export const itemFileUrl = (version: string) =>
  `${DDRAGON_BASE}/cdn/${version}/data/${LOCALE}/item.json`;

function httpDateToIso(value: string | null): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export class DataDragonAdapter implements SourceAdapter {
  readonly id = 'lol-ddragon';
  readonly gameId = 'lol';
  readonly source: SourceDefinition;

  constructor(private readonly context: AdapterContext) {
    this.source = context.mode === 'mock' ? mockSourceFor(LOL_DDRAGON_SOURCE) : LOL_DDRAGON_SOURCE;
  }

  get mode() {
    return this.context.mode;
  }

  private request(
    extra: { conditional?: { etag: string | null; lastModified: string | null } | null } = {},
  ) {
    return { rateLimitKey: LOL_DDRAGON_SOURCE.id, rateLimit: RATE_LIMIT, ...extra };
  }

  async discover(): Promise<DiscoveredResource[]> {
    const { data: realmData } = await this.context.http.getJson(
      `${DDRAGON_BASE}/realms/kr.json`,
      this.request(),
    );
    const realm = realmSchema.parse(realmData);
    const { data: versionsData } = await this.context.http.getJson(
      `${DDRAGON_BASE}/api/versions.json`,
      this.request(),
    );
    const versions = versionsSchema.parse(versionsData).filter((value) => SEMVER.test(value));
    const version = realm.n.champion;
    const index = versions.indexOf(version);
    const previousVersion = index >= 0 ? versions[index + 1] : undefined;
    if (!previousVersion)
      throw new Error(`Data Dragon version ${version} has no previous version to compare`);
    return [
      {
        externalId: `ddragon-${version}`,
        url: championFileUrl(version),
        hints: { version, itemVersion: realm.n.item, previousVersion },
      },
    ];
  }

  async fetch(
    resource: DiscoveredResource,
    previous?: { etag: string | null; lastModified: string | null } | null,
  ): Promise<FetchedDocument> {
    const hints = hintsSchema.parse(resource.hints);
    const fetchedAt = () => this.context.clock().toISOString();
    // Versioned files never change: a 304 on the champion file means nothing to do.
    const current = await this.context.http.get(
      championFileUrl(hints.version),
      this.request({ conditional: previous ?? null }),
    );
    const base = {
      sourceId: this.source.id,
      externalId: resource.externalId,
      url: resource.url,
      contentType: 'application/json',
      httpStatus: current.status,
      etag: current.headers.etag ?? previous?.etag ?? null,
      lastModified: current.headers['last-modified'] ?? previous?.lastModified ?? null,
      locale: 'ko-KR',
    };
    if (current.status === 304) {
      return { ...base, rawText: '', fetchedAt: fetchedAt(), notModified: true, metadata: null };
    }
    const items = await this.context.http.getJson(itemFileUrl(hints.itemVersion), this.request());
    const previousChampions = await this.context.http.getJson(
      championFileUrl(hints.previousVersion),
      this.request(),
    );
    const previousItems = await this.context.http.getJson(
      itemFileUrl(hints.previousVersion),
      this.request(),
    );

    const document = {
      format: DOCUMENT_FORMAT,
      version: hints.version,
      previousVersion: hints.previousVersion,
      sourceLastModified: current.headers['last-modified'] ?? null,
      current: extractSnapshot(JSON.parse(current.body) as unknown, items.data),
      previous: extractSnapshot(previousChampions.data, previousItems.data),
    };
    return {
      ...base,
      // A compact, deterministic extract of the four official files (not the full payloads).
      rawText: stableStringify(document),
      fetchedAt: fetchedAt(),
      notModified: false,
      metadata: {
        files: [
          championFileUrl(hints.version),
          itemFileUrl(hints.itemVersion),
          championFileUrl(hints.previousVersion),
          itemFileUrl(hints.previousVersion),
        ],
      },
    };
  }

  normalize(document: FetchedDocument): Promise<NormalizeResult> {
    const parsed = documentSchema.parse(JSON.parse(document.rawText));
    const diff = diffSnapshots(parsed.previous, parsed.current);
    const warnings: string[] = [];
    if (diff.changes.length === 0) {
      warnings.push(
        `no numeric changes between Data Dragon ${parsed.previousVersion} and ${parsed.version}`,
      );
      return Promise.resolve({
        candidates: [],
        parser: DDRAGON_PARSER,
        documentText: null,
        warnings,
      });
    }
    if (diff.changes.length > MAX_CHANGES) {
      warnings.push(`${diff.changes.length} changes truncated to ${MAX_CHANGES}`);
    }
    const candidate: CandidateOf<'PATCH'> = {
      kind: 'PATCH',
      gameId: this.gameId,
      sourceKey: `ddragon:${parsed.version}`,
      slugHint: null,
      title: `Data Dragon ${parsed.version} 게임 데이터 변경`,
      summary:
        `Riot Data Dragon ${parsed.previousVersion} → ${parsed.version} 비교: 챔피언 ${diff.championsChanged}명, ` +
        `아이템 ${diff.itemsChanged}개에서 수치 변경 ${diff.changes.length}건. 스킬 설명·패시브 등 텍스트 변경은 포함되지 않습니다.`,
      startAt: null,
      endAt: null,
      timing: null,
      sourceUrl: championFileUrl(parsed.version),
      sourcePublishedAt: httpDateToIso(parsed.sourceLastModified),
      sourceLocale: 'ko-KR',
      priority: 60,
      confidence: 1,
      evidence: [],
      isSynthetic: this.context.mode !== 'live',
      metadata: { dataset: 'ddragon', previousVersion: parsed.previousVersion },
      patch: {
        version: `Data Dragon ${parsed.version}`,
        releaseAt: null,
        changes: diff.changes.slice(0, MAX_CHANGES),
      },
    };
    return Promise.resolve({
      candidates: [candidate],
      parser: DDRAGON_PARSER,
      documentText: null,
      warnings,
    });
  }

  async healthCheck(): Promise<AdapterHealth> {
    const now = this.context.clock();
    try {
      const [resource] = await this.discover();
      return healthReport(
        this.id,
        [
          {
            name: 'realm and versions',
            ok: true,
            detail: `live data ${typeof resource?.hints?.version === 'string' ? resource.hints.version : 'unknown'}`,
          },
        ],
        now,
      );
    } catch (error) {
      return healthReport(
        this.id,
        [
          {
            name: 'realm and versions',
            ok: false,
            detail: error instanceof Error ? error.message : String(error),
          },
        ],
        now,
      );
    }
  }
}

export const dataDragonDefinition: AdapterDefinition = {
  id: 'lol-ddragon',
  gameId: 'lol',
  source: LOL_DDRAGON_SOURCE,
  description:
    'Riot Data Dragon: structured champion/item stat changes between data versions (KR realm)',
  supportedModes: ['mock', 'live'],
  credentials: [],
  scheduleEveryMinutes: 180,
  create: (context) => new DataDragonAdapter(context),
};
