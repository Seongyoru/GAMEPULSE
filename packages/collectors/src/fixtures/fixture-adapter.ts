/**
 * Fixture adapter: serves the synthetic GAMEPULSE fixture feed for a game from
 * `fixtures/sources/<gameId>.json` through the full ingestion pipeline (discover → fetch →
 * raw document → normalize → validate → deduplicate → publish). No network is involved.
 *
 * Fixture content is always marked synthetic and displayed with a "sample data" label.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  describeTimeZone,
  formatCompactDate,
  formatClockTime,
  normalizedCandidateSchema,
  stableStringify,
  type GameConfig,
  type NormalizedCandidate,
  type SourceDefinition,
} from '@gamepulse/domain';
import { z } from 'zod';
import type {
  AdapterContext,
  AdapterDefinition,
  AdapterHealth,
  DiscoveredResource,
  FetchedDocument,
  NormalizeResult,
  SourceAdapter,
} from '../types';
import { fixtureSourceFor } from '../sources';
import { FixtureError, materializeTimes } from './relative-time';

export const FIXTURE_PARSER = { id: 'fixture-json', version: '1', kind: 'fixture' as const };

const fixtureDocumentSchema = z.object({
  externalId: z.string().min(1),
  url: z.url(),
  publishedAt: z.string().min(1),
  items: z
    .array(z.record(z.string(), z.unknown()).and(z.object({ key: z.string().min(1) })))
    .min(1),
});

export const fixtureFileSchema = z.object({
  gameId: z.string().min(1),
  /** Zone used for "@+Nd/HH:mm" expressions and auto-generated source timing text. */
  timezone: z.string().min(1),
  locale: z.string().min(2),
  region: z.string().nullable(),
  documents: z.array(fixtureDocumentSchema).min(1),
});
export type FixtureFile = z.infer<typeof fixtureFileSchema>;
type FixtureDocument = z.infer<typeof fixtureDocumentSchema>;

interface MaterializedDocument {
  gameId: string;
  timezone: string;
  locale: string;
  region: string | null;
  document: FixtureDocument;
}

export function fixtureFilePath(fixturesDir: string, gameId: string): string {
  return join(fixturesDir, 'sources', `${gameId}.json`);
}

export async function loadFixtureFile(fixturesDir: string, gameId: string): Promise<FixtureFile> {
  const path = fixtureFilePath(fixturesDir, gameId);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    throw new FixtureError(`Cannot read fixture file ${path}`, { cause: error });
  }
  const parsed = fixtureFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new FixtureError(
      `Invalid fixture file ${path}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  if (parsed.data.gameId !== gameId)
    throw new FixtureError(`${path} declares gameId "${parsed.data.gameId}"`);
  return parsed.data;
}

/** "2026/10/08 10:00 (UTC+8)" — mirrors how official notices print times. */
function sourceTimeText(iso: unknown, timeZone: string): string | null {
  if (typeof iso !== 'string') return null;
  const date = new Date(iso);
  return `${formatCompactDate(date, timeZone).replaceAll('.', '/')} ${formatClockTime(date, timeZone)} (${describeTimeZone(timeZone, date)})`;
}

function completeItem(item: Record<string, unknown>, doc: MaterializedDocument): unknown {
  const { key, timing, ...rest } = item;
  const startAt = rest.startAt ?? null;
  const endAt = rest.endAt ?? null;
  return {
    slugHint: null,
    summary: null,
    priority: 50,
    confidence: 1,
    evidence: [],
    metadata: null,
    sourcePublishedAt: doc.document.publishedAt,
    ...rest,
    startAt,
    endAt,
    timing:
      timing === 'auto'
        ? {
            sourceTimezone: doc.timezone,
            startAtSource: sourceTimeText(startAt, doc.timezone),
            endAtSource: sourceTimeText(endAt, doc.timezone),
            region: doc.region,
            precision: 'DATETIME',
          }
        : (timing ?? null),
    gameId: doc.gameId,
    sourceKey: `${doc.document.externalId}#${String(key)}`,
    sourceUrl: typeof rest.sourceUrl === 'string' ? rest.sourceUrl : doc.document.url,
    sourceLocale: doc.locale,
    isSynthetic: true,
  };
}

export class FixtureAdapter implements SourceAdapter {
  readonly id: string;
  readonly gameId: string;
  readonly mode = 'fixture' as const;
  private filePromise: Promise<FixtureFile> | null = null;

  constructor(
    readonly source: SourceDefinition,
    private readonly context: Pick<AdapterContext, 'fixturesDir' | 'fixtureAnchor' | 'clock'>,
  ) {
    this.id = source.id;
    this.gameId = source.gameId;
  }

  private file(): Promise<FixtureFile> {
    this.filePromise ??= loadFixtureFile(this.context.fixturesDir, this.gameId);
    return this.filePromise;
  }

  async discover(): Promise<DiscoveredResource[]> {
    const file = await this.file();
    return file.documents.map((document) => ({
      externalId: document.externalId,
      url: document.url,
    }));
  }

  async fetch(resource: DiscoveredResource): Promise<FetchedDocument> {
    const file = await this.file();
    const document = file.documents.find(
      (candidate) => candidate.externalId === resource.externalId,
    );
    if (!document)
      throw new FixtureError(`Fixture document ${String(resource.externalId)} not found`);
    const materialized: MaterializedDocument = {
      gameId: file.gameId,
      timezone: file.timezone,
      locale: file.locale,
      region: file.region,
      document: materializeTimes(
        document,
        this.context.fixtureAnchor,
        file.timezone,
      ) as FixtureDocument,
    };
    return {
      sourceId: this.source.id,
      externalId: document.externalId,
      url: document.url,
      contentType: 'application/json',
      rawText: stableStringify(materialized),
      fetchedAt: this.context.clock().toISOString(),
      httpStatus: null,
      etag: null,
      lastModified: null,
      locale: file.locale,
      notModified: false,
      metadata: { fixture: true, anchor: this.context.fixtureAnchor.toISOString() },
    };
  }

  normalize(fetched: FetchedDocument): Promise<NormalizeResult> {
    const doc = JSON.parse(fetched.rawText) as MaterializedDocument;
    const candidates: NormalizedCandidate[] = [];
    const warnings: string[] = [];
    for (const item of doc.document.items) {
      const parsed = normalizedCandidateSchema.safeParse(completeItem(item, doc));
      if (parsed.success) candidates.push(parsed.data);
      else {
        warnings.push(
          `fixture item ${doc.document.externalId}#${item.key}: ${parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ')}`,
        );
      }
    }
    return Promise.resolve({ candidates, parser: FIXTURE_PARSER, documentText: null, warnings });
  }

  async healthCheck(): Promise<AdapterHealth> {
    const checks = [];
    try {
      const file = await this.file();
      checks.push({
        name: 'fixture file readable',
        ok: true,
        detail: `${file.documents.length} documents`,
      });
      const items = file.documents.reduce((sum, document) => sum + document.items.length, 0);
      checks.push({ name: 'fixture has content', ok: items > 0, detail: `${items} items` });
    } catch (error) {
      checks.push({
        name: 'fixture file readable',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return {
      adapterId: this.id,
      status: checks.every((check) => check.ok) ? 'HEALTHY' : 'UNHEALTHY',
      checkedAt: this.context.clock().toISOString(),
      checks,
    };
  }
}

export function fixtureAdapterDefinition(game: GameConfig): AdapterDefinition {
  const source = fixtureSourceFor(game);
  return {
    id: source.id,
    gameId: game.gameId,
    source,
    description: `Synthetic fixture feed for ${game.name} (fixtures/sources/${game.gameId}.json)`,
    supportedModes: ['fixture'],
    credentials: [],
    scheduleEveryMinutes: null,
    create: (context) => new FixtureAdapter(source, context),
  };
}
