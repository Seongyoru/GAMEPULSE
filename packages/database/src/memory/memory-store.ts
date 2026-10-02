/**
 * In-memory ContentStore. Used by fixture mode (no database), unit tests and as the
 * executable specification the PostgreSQL store is contract-tested against.
 */
import { randomUUID } from 'node:crypto';
import {
  applyContentQuery,
  slugWithSuffix,
  type ContentQuery,
  type ContentRecord,
  type ContentSlugEntry,
  type ContentStore,
  type ExistingContentRef,
  type FinishRunInput,
  type GameConfig,
  type IngestionRunRecord,
  type JsonValue,
  type NormalizedCandidate,
  type ParseResultInput,
  type ProvenanceEntry,
  type ProvenanceInput,
  type ProvenanceRole,
  type PublishInput,
  type PublishOutcome,
  type RawDocumentInput,
  type ResetRuleDefinition,
  type SourceDefinition,
  type StartRunInput,
  type StoredRawDocument,
  type SyncCounts,
  type ValidationResultInput,
} from '@gamepulse/domain';
import {
  candidateDetail,
  contentIdFor,
  relatedSourceKeys,
  sourceSummaryOf,
  toIso,
  toIsoOrNull,
} from '../mapping';

interface StoredItem {
  id: string;
  slug: string;
  candidate: NormalizedCandidate;
  sourceId: string;
  semanticKey: string;
  contentHash: string;
  status: PublishInput['status'];
  verification: PublishInput['verification'];
  verifiedAt: string | null;
  validationStatus: PublishInput['validationStatus'];
  parser: { id: string; version: string };
  rawDocumentId: string | null;
  publishedAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

interface StoredProvenance {
  sourceId: string;
  sourceKey: string;
  sourceUrl: string;
  rawDocumentId: string | null;
  role: ProvenanceRole;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface StoredRaw extends RawDocumentInput {
  id: string;
  lastCheckedAt: string;
}

const key = (...parts: string[]) => parts.join('\u0000');

function syncInto<T>(map: Map<string, T>, id: string, value: T): 'created' | 'updated' | 'unchanged' {
  const existing = map.get(id);
  map.set(id, value);
  if (existing === undefined) return 'created';
  return JSON.stringify(existing) === JSON.stringify(value) ? 'unchanged' : 'updated';
}

function count(outcomes: Array<'created' | 'updated' | 'unchanged'>): SyncCounts {
  return {
    created: outcomes.filter((o) => o === 'created').length,
    updated: outcomes.filter((o) => o === 'updated').length,
    unchanged: outcomes.filter((o) => o === 'unchanged').length,
  };
}

export class InMemoryContentStore implements ContentStore {
  private readonly games = new Map<string, GameConfig>();
  private readonly sources = new Map<string, SourceDefinition>();
  private readonly resetRules = new Map<string, ResetRuleDefinition>();
  private readonly runs = new Map<string, IngestionRunRecord>();
  private readonly rawDocuments: StoredRaw[] = [];
  private readonly parseResults = new Map<string, ParseResultInput>();
  private readonly validationResults: ValidationResultInput[] = [];
  private readonly items = new Map<string, StoredItem>();
  private readonly slugIndex = new Map<string, string>();
  private readonly sourceKeyIndex = new Map<string, string>();
  private readonly provenance = new Map<string, StoredProvenance[]>();

  // ── registry sync ──────────────────────────────────────────────────────────

  syncGames(games: readonly GameConfig[]): Promise<SyncCounts> {
    return Promise.resolve(count(games.map((game) => syncInto(this.games, game.gameId, game))));
  }

  syncSources(sources: readonly SourceDefinition[]): Promise<SyncCounts> {
    return Promise.resolve(count(sources.map((source) => syncInto(this.sources, source.id, source))));
  }

  syncResetRules(rules: readonly ResetRuleDefinition[]): Promise<SyncCounts> {
    return Promise.resolve(count(rules.map((rule) => syncInto(this.resetRules, rule.id, rule))));
  }

  // ── ingestion runs ─────────────────────────────────────────────────────────

  startRun(input: StartRunInput): Promise<IngestionRunRecord | null> {
    const nowMs = Date.parse(input.now);
    for (const run of this.runs.values()) {
      if (run.adapterId !== input.adapterId || run.status !== 'RUNNING') continue;
      if (nowMs - Date.parse(run.startedAt) > input.staleAfterMs) {
        this.runs.set(run.id, { ...run, status: 'ABANDONED', finishedAt: input.now, error: 'stale run lock released' });
      } else {
        return Promise.resolve(null);
      }
    }
    const run: IngestionRunRecord = {
      id: randomUUID(),
      adapterId: input.adapterId,
      sourceId: input.sourceId,
      gameId: input.gameId,
      trigger: input.trigger,
      mode: input.mode,
      status: 'RUNNING',
      startedAt: toIso(input.now),
      finishedAt: null,
      counters: { discovered: 0, fetched: 0, new: 0, updated: 0, unchanged: 0, failed: 0, skipped: 0 },
      error: null,
    };
    this.runs.set(run.id, run);
    return Promise.resolve(run);
  }

  finishRun(runId: string, input: FinishRunInput): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      this.runs.set(runId, {
        ...run,
        status: input.status,
        finishedAt: toIso(input.finishedAt),
        counters: { ...input.counters },
        error: input.error,
      });
    }
    return Promise.resolve();
  }

  listRuns(limit: number): Promise<IngestionRunRecord[]> {
    return Promise.resolve(
      [...this.runs.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, limit),
    );
  }

  // ── raw documents & parse cache ────────────────────────────────────────────

  findLatestRawDocument(sourceId: string, documentKey: string): Promise<StoredRawDocument | null> {
    const latest = this.rawDocuments
      .filter((doc) => doc.sourceId === sourceId && doc.documentKey === documentKey)
      .sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))[0];
    return Promise.resolve(
      latest
        ? {
            id: latest.id,
            contentHash: latest.contentHash,
            etag: latest.etag,
            lastModified: latest.lastModified,
            fetchedAt: latest.fetchedAt,
          }
        : null,
    );
  }

  insertRawDocument(input: RawDocumentInput): Promise<{ id: string }> {
    const existing = this.rawDocuments.find(
      (doc) =>
        doc.sourceId === input.sourceId &&
        doc.documentKey === input.documentKey &&
        doc.contentHash === input.contentHash,
    );
    const fetchedAt = toIso(input.fetchedAt);
    if (existing) {
      Object.assign(existing, { ...input, id: existing.id, fetchedAt, lastCheckedAt: fetchedAt });
      return Promise.resolve({ id: existing.id });
    }
    const id = randomUUID();
    this.rawDocuments.push({ ...input, id, fetchedAt, lastCheckedAt: fetchedAt });
    return Promise.resolve({ id });
  }

  touchRawDocument(id: string, checkedAt: string): Promise<void> {
    const doc = this.rawDocuments.find((candidate) => candidate.id === id);
    if (doc) doc.lastCheckedAt = toIso(checkedAt);
    return Promise.resolve();
  }

  pruneRawText(olderThan: string): Promise<number> {
    const cutoff = Date.parse(olderThan);
    let pruned = 0;
    for (const doc of this.rawDocuments) {
      if (doc.rawText !== null && Date.parse(doc.fetchedAt) < cutoff) {
        doc.rawText = null;
        pruned += 1;
      }
    }
    return Promise.resolve(pruned);
  }

  findParseResult(inputHash: string, parserId: string, parserVersion: string): Promise<{ output: JsonValue | null } | null> {
    const found = this.parseResults.get(key(inputHash, parserId, parserVersion));
    return Promise.resolve(found ? { output: found.output } : null);
  }

  insertParseResult(input: ParseResultInput): Promise<void> {
    this.parseResults.set(key(input.inputHash, input.parserId, input.parserVersion), { ...input });
    return Promise.resolve();
  }

  insertValidationResults(results: readonly ValidationResultInput[]): Promise<void> {
    this.validationResults.push(...results.map((result) => ({ ...result })));
    return Promise.resolve();
  }

  /** Test/diagnostic accessor. */
  getValidationResults(): readonly ValidationResultInput[] {
    return this.validationResults;
  }

  // ── content ────────────────────────────────────────────────────────────────

  private refOf(item: StoredItem): ExistingContentRef {
    const source = this.sources.get(item.sourceId);
    return {
      id: item.id,
      slug: item.slug,
      gameId: item.candidate.gameId,
      type: item.candidate.kind,
      sourceId: item.sourceId,
      sourceType: source?.type ?? 'FIXTURE',
      sourceKey: item.candidate.sourceKey,
      semanticKey: item.semanticKey,
      contentHash: item.contentHash,
      status: item.status,
      verification: item.verification,
    };
  }

  findContentBySourceKey(sourceId: string, sourceKey: string): Promise<ExistingContentRef | null> {
    const direct = this.sourceKeyIndex.get(key(sourceId, sourceKey));
    if (direct) {
      const item = this.items.get(direct);
      if (item) return Promise.resolve(this.refOf(item));
    }
    for (const [contentId, rows] of this.provenance) {
      if (rows.some((row) => row.sourceId === sourceId && row.sourceKey === sourceKey)) {
        const item = this.items.get(contentId);
        if (item) return Promise.resolve(this.refOf(item));
      }
    }
    return Promise.resolve(null);
  }

  findContentBySemanticKey(gameId: string, semanticKey: string): Promise<ExistingContentRef[]> {
    return Promise.resolve(
      [...this.items.values()]
        .filter((item) => item.candidate.gameId === gameId && item.semanticKey === semanticKey)
        .map((item) => this.refOf(item)),
    );
  }

  private uniqueSlug(preferred: string, contentId: string, seed: string): string {
    const owner = this.slugIndex.get(preferred);
    if (owner === undefined || owner === contentId) return preferred;
    return slugWithSuffix(preferred, seed);
  }

  private upsertProvenance(contentId: string, input: ProvenanceInput): void {
    const rows = this.provenance.get(contentId) ?? [];
    const existing = rows.find((row) => row.sourceId === input.sourceId && row.sourceKey === input.sourceKey);
    const seenAt = toIso(input.seenAt);
    if (existing) {
      existing.lastSeenAt = seenAt;
      existing.sourceUrl = input.sourceUrl;
      existing.rawDocumentId = input.rawDocumentId ?? existing.rawDocumentId;
      existing.role = input.role;
    } else {
      rows.push({
        sourceId: input.sourceId,
        sourceKey: input.sourceKey,
        sourceUrl: input.sourceUrl,
        rawDocumentId: input.rawDocumentId,
        role: input.role,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      });
    }
    this.provenance.set(contentId, rows);
  }

  publishContent(input: PublishInput): Promise<PublishOutcome> {
    const { candidate, source } = input;
    const now = toIso(input.now);
    const existingId = input.supersedeId ?? this.sourceKeyIndex.get(key(source.id, candidate.sourceKey)) ?? null;
    const existing = existingId === null ? undefined : this.items.get(existingId);

    if (existing) {
      const sameSource = existing.sourceId === source.id && existing.candidate.sourceKey === candidate.sourceKey;
      if (sameSource && existing.contentHash === input.contentHash && existing.status === input.status) {
        existing.lastSeenAt = now;
        this.upsertProvenance(existing.id, this.primaryProvenance(input, now));
        return Promise.resolve({ id: existing.id, slug: existing.slug, outcome: 'unchanged' });
      }
      if (!sameSource) {
        this.sourceKeyIndex.delete(key(existing.sourceId, existing.candidate.sourceKey));
        for (const row of this.provenance.get(existing.id) ?? []) row.role = 'SUPPORTING';
      }
      const updated: StoredItem = {
        ...existing,
        candidate,
        sourceId: source.id,
        semanticKey: input.semanticKey,
        contentHash: input.contentHash,
        status: input.status,
        verification: input.verification,
        verifiedAt: toIsoOrNull(input.verifiedAt),
        validationStatus: input.validationStatus,
        parser: { ...input.parser },
        rawDocumentId: input.rawDocumentId,
        updatedAt: now,
        lastSeenAt: now,
      };
      this.items.set(existing.id, updated);
      this.sourceKeyIndex.set(key(source.id, candidate.sourceKey), existing.id);
      this.upsertProvenance(existing.id, this.primaryProvenance(input, now));
      return Promise.resolve({ id: existing.id, slug: existing.slug, outcome: 'updated' });
    }

    const id = contentIdFor(source.id, candidate.sourceKey);
    const slug = this.uniqueSlug(input.slug, id, `${source.id}:${candidate.sourceKey}`);
    this.items.set(id, {
      id,
      slug,
      candidate,
      sourceId: source.id,
      semanticKey: input.semanticKey,
      contentHash: input.contentHash,
      status: input.status,
      verification: input.verification,
      verifiedAt: toIsoOrNull(input.verifiedAt),
      validationStatus: input.validationStatus,
      parser: { ...input.parser },
      rawDocumentId: input.rawDocumentId,
      publishedAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });
    this.slugIndex.set(slug, id);
    this.sourceKeyIndex.set(key(source.id, candidate.sourceKey), id);
    this.upsertProvenance(id, this.primaryProvenance(input, now));
    return Promise.resolve({ id, slug, outcome: 'created' });
  }

  private primaryProvenance(input: PublishInput, now: string): ProvenanceInput {
    return {
      sourceId: input.source.id,
      sourceKey: input.candidate.sourceKey,
      sourceUrl: input.candidate.sourceUrl,
      rawDocumentId: input.rawDocumentId,
      role: 'PRIMARY',
      seenAt: now,
    };
  }

  recordProvenance(contentId: string, input: ProvenanceInput): Promise<void> {
    if (this.items.has(contentId)) this.upsertProvenance(contentId, input);
    return Promise.resolve();
  }

  // ── read side ──────────────────────────────────────────────────────────────

  private slugFor(sourceId: string, sourceKey: string | null): string | null {
    if (sourceKey === null) return null;
    const id = this.sourceKeyIndex.get(key(sourceId, sourceKey));
    return id === undefined ? null : (this.items.get(id)?.slug ?? null);
  }

  private toRecord(item: StoredItem): ContentRecord {
    const { candidate } = item;
    const source = this.sources.get(item.sourceId);
    if (!source) throw new Error(`Source "${item.sourceId}" is not registered in the store`);
    const links = relatedSourceKeys(candidate);
    const provenance: ProvenanceEntry[] = (this.provenance.get(item.id) ?? [])
      .map((row) => {
        const rowSource = this.sources.get(row.sourceId);
        return {
          sourceId: row.sourceId,
          sourceName: rowSource?.name ?? row.sourceId,
          sourceType: rowSource?.type ?? 'FIXTURE',
          sourceUrl: row.sourceUrl,
          role: row.role,
          firstSeenAt: row.firstSeenAt,
          lastSeenAt: row.lastSeenAt,
        };
      })
      .sort((a, b) => (a.role === b.role ? a.firstSeenAt.localeCompare(b.firstSeenAt) : a.role === 'PRIMARY' ? -1 : 1));

    return {
      id: item.id,
      slug: item.slug,
      gameId: candidate.gameId,
      type: candidate.kind,
      title: candidate.title,
      summary: candidate.summary,
      startAt: toIsoOrNull(candidate.startAt),
      endAt: toIsoOrNull(candidate.endAt),
      timing: candidate.timing === null ? null : { ...candidate.timing },
      publishedAt: item.publishedAt,
      sourcePublishedAt: toIsoOrNull(candidate.sourcePublishedAt),
      updatedAt: item.updatedAt,
      lastSeenAt: item.lastSeenAt,
      priority: candidate.priority,
      status: item.status,
      verification: item.verification,
      verifiedAt: item.verifiedAt,
      validationStatus: item.validationStatus,
      confidence: candidate.confidence,
      isSynthetic: candidate.isSynthetic,
      sourceLocale: candidate.sourceLocale,
      parser: { ...item.parser },
      source: sourceSummaryOf(source, candidate.sourceUrl),
      provenance,
      detail: candidateDetail(candidate, {
        relatedSlug: this.slugFor(item.sourceId, links.related),
        compensationSlug: this.slugFor(item.sourceId, links.compensation),
      }),
    };
  }

  listContent(query: ContentQuery): Promise<ContentRecord[]> {
    const records = [...this.items.values()].map((item) => this.toRecord(item));
    return Promise.resolve(applyContentQuery(records, query));
  }

  getContentBySlug(slug: string): Promise<ContentRecord | null> {
    const id = this.slugIndex.get(slug);
    const item = id === undefined ? undefined : this.items.get(id);
    if (!item || item.status !== 'PUBLISHED') return Promise.resolve(null);
    return Promise.resolve(this.toRecord(item));
  }

  listResetRules(gameIds?: readonly string[]): Promise<ResetRuleDefinition[]> {
    return Promise.resolve(
      [...this.resetRules.values()]
        .filter((rule) => !gameIds || gameIds.includes(rule.gameId))
        .sort((a, b) => a.gameId.localeCompare(b.gameId) || a.id.localeCompare(b.id))
        .map((rule) => ({ ...rule, anchor: toIsoOrNull(rule.anchor) })),
    );
  }

  listContentSlugs(): Promise<ContentSlugEntry[]> {
    return Promise.resolve(
      [...this.items.values()]
        .filter((item) => item.status === 'PUBLISHED')
        .map((item) => ({
          slug: item.slug,
          type: item.candidate.kind,
          gameId: item.candidate.gameId,
          updatedAt: item.updatedAt,
          isSynthetic: item.candidate.isSynthetic,
        }))
        .sort((a, b) => a.slug.localeCompare(b.slug)),
    );
  }

  getLastUpdatedAt(gameId?: string): Promise<string | null> {
    const times = [...this.items.values()]
      .filter((item) => item.status === 'PUBLISHED' && (!gameId || item.candidate.gameId === gameId))
      .map((item) => Date.parse(item.updatedAt));
    return Promise.resolve(times.length === 0 ? null : new Date(Math.max(...times)).toISOString());
  }
}
