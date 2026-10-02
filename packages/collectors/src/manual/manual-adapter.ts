/**
 * Manual ingestion adapter: `pnpm ingest:manual <file.json>`. The fallback whenever an automated
 * collector is unavailable or not permitted. The file goes through the same pipeline as every
 * collector (raw document hash, validation, deduplication, provenance).
 */
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import {
  manualIngestionFileSchema,
  parseManualItems,
  requireGame,
  type CollectorMode,
} from '@gamepulse/domain';
import type {
  AdapterHealth,
  DiscoveredResource,
  FetchedDocument,
  NormalizeResult,
  SourceAdapter,
} from '../types';
import { manualSourceFor } from '../sources';

export const MANUAL_PARSER = { id: 'manual-json', version: '1', kind: 'manual' as const };

export class ManualInputError extends Error {
  override name = 'ManualInputError';
}

/** Reads and validates the file header to find the target game. */
export async function readManualFileGame(filePath: string): Promise<string> {
  const raw = await readFile(resolve(filePath), 'utf8');
  const parsed = manualIngestionFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new ManualInputError(
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  return parsed.data.gameId;
}

export class ManualFileAdapter implements SourceAdapter {
  readonly id: string;
  readonly gameId: string;
  readonly mode: CollectorMode = 'live';
  readonly source;
  private readonly filePath: string;

  constructor(
    gameId: string,
    filePath: string,
    private readonly clock: () => Date,
    private readonly locale = 'ko-KR',
  ) {
    const game = requireGame(gameId);
    this.source = manualSourceFor(game);
    this.id = this.source.id;
    this.gameId = gameId;
    this.filePath = resolve(filePath);
  }

  discover(): Promise<DiscoveredResource[]> {
    return Promise.resolve([
      { externalId: `file:${basename(this.filePath)}`, url: `file://${this.filePath}` },
    ]);
  }

  async fetch(resource: DiscoveredResource): Promise<FetchedDocument> {
    const rawText = await readFile(this.filePath, 'utf8');
    return {
      sourceId: this.source.id,
      externalId: resource.externalId,
      url: this.source.homepageUrl,
      contentType: 'application/json',
      rawText,
      fetchedAt: this.clock().toISOString(),
      httpStatus: null,
      etag: null,
      lastModified: null,
      locale: this.locale,
      notModified: false,
      metadata: { file: basename(this.filePath) },
    };
  }

  normalize(document: FetchedDocument): Promise<NormalizeResult> {
    const parsed = manualIngestionFileSchema.safeParse(JSON.parse(document.rawText));
    if (!parsed.success) {
      throw new ManualInputError(
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }
    if (parsed.data.gameId !== this.gameId) {
      throw new ManualInputError(
        `File is for "${parsed.data.gameId}", adapter expects "${this.gameId}"`,
      );
    }
    const { candidates, errors } = parseManualItems(parsed.data, this.locale);
    return Promise.resolve({
      candidates,
      parser: MANUAL_PARSER,
      documentText: null,
      warnings: errors.map((error) => `item ${error.index}: ${error.issues.join('; ')}`),
    });
  }

  async healthCheck(): Promise<AdapterHealth> {
    let ok = true;
    let detail = 'readable';
    try {
      await readFile(this.filePath, 'utf8');
    } catch (error) {
      ok = false;
      detail = error instanceof Error ? error.message : String(error);
    }
    return {
      adapterId: this.id,
      status: ok ? 'HEALTHY' : 'UNHEALTHY',
      checkedAt: this.clock().toISOString(),
      checks: [{ name: 'manual file', ok, detail }],
    };
  }
}
