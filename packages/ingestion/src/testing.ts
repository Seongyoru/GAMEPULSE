/**
 * Scriptable SourceAdapter for pipeline tests (failure injection, custom candidates).
 */
import type {
  AdapterHealth,
  DiscoveredResource,
  FetchedDocument,
  NormalizeParserKind,
  NormalizeResult,
  SourceAdapter,
} from '@gamepulse/collectors';
import type { NormalizedCandidate, SourceDefinition } from '@gamepulse/domain';

export interface ScriptedDocument {
  externalId: string;
  url: string;
  /** Raw text (hashed by the pipeline); defaults to the JSON of the candidates. */
  rawText?: string;
  candidates: NormalizedCandidate[];
  fetchError?: Error;
  normalizeError?: Error;
}

export class ScriptedAdapter implements SourceAdapter {
  readonly id: string;
  readonly gameId: string;
  readonly mode = 'mock' as const;
  discoverError: Error | null = null;
  fetchCalls = 0;
  normalizeCalls = 0;

  constructor(
    readonly source: SourceDefinition,
    public documents: ScriptedDocument[],
    private readonly parser: { id: string; version: string; kind: NormalizeParserKind } = {
      id: 'scripted',
      version: '1',
      kind: 'deterministic',
    },
    private readonly documentText: string | null = null,
  ) {
    this.id = source.id;
    this.gameId = source.gameId;
  }

  discover(): Promise<DiscoveredResource[]> {
    if (this.discoverError) return Promise.reject(this.discoverError);
    return Promise.resolve(
      this.documents.map((doc) => ({ externalId: doc.externalId, url: doc.url })),
    );
  }

  fetch(resource: DiscoveredResource): Promise<FetchedDocument> {
    this.fetchCalls += 1;
    const doc = this.documents.find((candidate) => candidate.externalId === resource.externalId);
    if (!doc) return Promise.reject(new Error('unknown document'));
    if (doc.fetchError) return Promise.reject(doc.fetchError);
    return Promise.resolve({
      sourceId: this.source.id,
      externalId: doc.externalId,
      url: doc.url,
      contentType: 'application/json',
      rawText: doc.rawText ?? JSON.stringify(doc.candidates),
      fetchedAt: '2026-10-02T03:00:00.000Z',
      httpStatus: 200,
      etag: null,
      lastModified: null,
      locale: 'ko-KR',
      notModified: false,
      metadata: null,
    });
  }

  normalize(document: FetchedDocument): Promise<NormalizeResult> {
    this.normalizeCalls += 1;
    const doc = this.documents.find((candidate) => candidate.externalId === document.externalId);
    if (doc?.normalizeError) return Promise.reject(doc.normalizeError);
    return Promise.resolve({
      candidates: doc?.candidates ?? [],
      parser: this.parser,
      documentText: this.documentText,
      warnings: [],
    });
  }

  healthCheck(): Promise<AdapterHealth> {
    return Promise.resolve({
      adapterId: this.id,
      status: 'HEALTHY',
      checkedAt: '2026-10-02T03:00:00.000Z',
      checks: [],
    });
  }
}
