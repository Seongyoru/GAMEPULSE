/**
 * Manual text ingestion: `pnpm ingest:text <file> --game <id> --url <official notice URL>`.
 *
 * For sources GAMEPULSE may not collect automatically (Genshin Impact, Wuthering Waves), an
 * operator saves the text of an official notice they read and the configured parser
 * (rule-based by default, Claude when enabled) structures it. The text is a raw document
 * like any other: hashed, retained only for RAW_TEXT_RETENTION_DAYS, never rendered.
 * AI output must carry evidence found in this text, and AI-extracted facts are published as
 * UNVERIFIED (an operator vouches only for what they typed).
 */
import { readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import {
  defaultRegion,
  fnv1a32,
  requireGame,
  sanitizePlainText,
  type CollectorMode,
  type SourceDefinition,
} from '@gamepulse/domain';
import {
  aiExtractionSchema,
  extractionToCandidates,
  htmlToText,
  PARSE_TASKS,
  type AIParser,
  type ParseTask,
} from '@gamepulse/parsers';
import { isAllowedHost } from '../adapters/shared';
import { manualSourceFor } from '../sources';
import type {
  AdapterHealth,
  DiscoveredResource,
  FetchedDocument,
  NormalizeResult,
  SourceAdapter,
} from '../types';
import { ManualInputError } from './manual-adapter';

export interface ManualTextOptions {
  gameId: string;
  filePath: string;
  /** Official URL of the notice the text was taken from (must be an official host). */
  url: string;
  task?: ParseTask;
  title?: string | null;
  /** Publication time stated by the source (ISO). */
  publishedAt?: string | null;
  /** Zone the source uses for unlabeled times (operator-declared); null = never assume one. */
  defaultTimezone?: string | null;
  locale?: string;
  parser: AIParser;
  clock: () => Date;
}

export class ManualTextAdapter implements SourceAdapter {
  readonly id: string;
  readonly gameId: string;
  readonly mode: CollectorMode = 'live';
  readonly source: SourceDefinition;
  private readonly filePath: string;
  private readonly task: ParseTask;

  constructor(private readonly options: ManualTextOptions) {
    const game = requireGame(options.gameId);
    this.source = manualSourceFor(game);
    this.id = this.source.id;
    this.gameId = game.gameId;
    this.filePath = resolve(options.filePath);
    this.task = options.task ?? 'CLASSIFY';
    if (!PARSE_TASKS.includes(this.task)) throw new ManualInputError(`Unknown task ${this.task}`);
    if (!/^https:\/\//.test(options.url) || !isAllowedHost(options.url, this.source.allowedHosts)) {
      throw new ManualInputError(
        `--url must be an https URL on an official host of ${game.name} (${this.source.allowedHosts.join(', ')})`,
      );
    }
  }

  discover(): Promise<DiscoveredResource[]> {
    // Identity is the official notice URL: re-ingesting the same notice updates its records.
    return Promise.resolve([
      { externalId: `text:${fnv1a32(this.options.url)}`, url: this.options.url },
    ]);
  }

  async fetch(resource: DiscoveredResource): Promise<FetchedDocument> {
    const raw = await readFile(this.filePath, 'utf8');
    const isHtml = ['.html', '.htm'].includes(extname(this.filePath).toLowerCase());
    const text = sanitizePlainText(isHtml ? htmlToText(raw) : raw).trim();
    if (text === '') throw new ManualInputError(`${this.filePath} contains no text`);
    return {
      sourceId: this.source.id,
      externalId: resource.externalId,
      url: this.options.url,
      contentType: 'text/plain',
      rawText: text,
      fetchedAt: this.options.clock().toISOString(),
      httpStatus: null,
      etag: null,
      lastModified: null,
      locale: this.options.locale ?? 'ko-KR',
      notModified: false,
      metadata: { file: basename(this.filePath), task: this.task },
    };
  }

  async normalize(document: FetchedDocument): Promise<NormalizeResult> {
    const game = requireGame(this.gameId);
    const region = defaultRegion(game);
    const parser = this.options.parser;
    const output = await parser.parse({
      task: this.task,
      gameId: this.gameId,
      sourceUrl: document.url,
      sourceLocale: document.locale ?? 'ko-KR',
      text: document.rawText,
      title: this.options.title ?? null,
      publishedAt: this.options.publishedAt ?? null,
      defaultTimezone: this.options.defaultTimezone ?? null,
      serverTimezone: region?.timezone ?? game.timezone,
    });
    const extraction = aiExtractionSchema.parse(output.extraction);
    const { candidates, dropped } = extractionToCandidates(extraction, {
      gameId: this.gameId,
      sourceUrl: document.url,
      sourceLocale: document.locale ?? 'ko-KR',
      sourcePublishedAt: this.options.publishedAt ?? null,
      sourceKeyPrefix: document.externalId ?? document.url,
      region: region?.id ?? null,
    });
    const warnings = [...dropped];
    if (candidates.length === 0) warnings.push(`${parser.id} found nothing to publish`);
    for (const candidate of candidates) {
      if (candidate.timing && candidate.startAt === null && candidate.timing.startAtSource) {
        warnings.push(
          `"${candidate.title}": time "${candidate.timing.startAtSource}" kept unnormalized (no zone label and no --default-zone)`,
        );
      }
    }
    return {
      candidates,
      parser: { id: parser.id, version: parser.version, kind: parser.kind },
      // Evidence excerpts are verified against exactly this text.
      documentText: document.rawText,
      warnings,
    };
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
      checkedAt: this.options.clock().toISOString(),
      checks: [{ name: 'notice text file', ok, detail }],
    };
  }
}
