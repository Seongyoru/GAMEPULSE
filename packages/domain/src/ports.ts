/**
 * Persistence ports. Implemented by @gamepulse/database for PostgreSQL (Drizzle) and for
 * memory (fixture mode, tests). Shared contract tests keep both implementations identical.
 */
import type { ContentRecord } from './content';
import type {
  CollectorMode,
  ContentStatus,
  ContentType,
  IngestionRunStatus,
  IngestionTrigger,
  ProvenanceRole,
  SourceType,
  ValidationStatus,
  VerificationState,
} from './enums';
import type { GameConfig } from './games/types';
import type { JsonValue } from './identity';
import type { NormalizedCandidate } from './schemas/candidate';
import type { ResetRuleDefinition } from './schemas/reset';
import type { SourceDefinition } from './schemas/source';

export interface RawDocumentInput {
  sourceId: string;
  /** externalId ?? canonical URL — identity of the document within the source. */
  documentKey: string;
  externalId: string | null;
  url: string;
  contentHash: string;
  contentType: string;
  /** Internal processing copy; never rendered; subject to retention pruning. */
  rawText: string | null;
  fetchedAt: string;
  httpStatus: number | null;
  etag: string | null;
  lastModified: string | null;
  locale: string | null;
  ingestionRunId: string | null;
  metadata: { [key: string]: JsonValue } | null;
}

export interface StoredRawDocument {
  id: string;
  contentHash: string;
  etag: string | null;
  lastModified: string | null;
  fetchedAt: string;
}

export interface ParseResultInput {
  rawDocumentId: string | null;
  parserId: string;
  parserVersion: string;
  inputHash: string;
  status: 'SUCCEEDED' | 'FAILED';
  output: JsonValue | null;
  error: string | null;
  model: string | null;
  usage: JsonValue | null;
  createdAt: string;
}

export interface ValidationIssue {
  code: string;
  severity: Exclude<ValidationStatus, 'VALID'>;
  field: string | null;
  message: string;
}

export interface ValidationResultInput {
  ingestionRunId: string | null;
  rawDocumentId: string | null;
  contentItemId: string | null;
  sourceId: string;
  candidateKey: string;
  status: ValidationStatus;
  issues: ValidationIssue[];
  validatorVersion: string;
  createdAt: string;
}

export interface ExistingContentRef {
  id: string;
  slug: string;
  gameId: string;
  type: ContentType;
  sourceId: string;
  sourceType: SourceType;
  sourceKey: string;
  semanticKey: string;
  contentHash: string;
  status: ContentStatus;
  verification: VerificationState;
}

export interface PublishInput {
  candidate: NormalizedCandidate;
  source: SourceDefinition;
  semanticKey: string;
  contentHash: string;
  /** Preferred slug for new records; the store guarantees uniqueness. */
  slug: string;
  status: ContentStatus;
  verification: VerificationState;
  verifiedAt: string | null;
  validationStatus: ValidationStatus;
  parser: { id: string; version: string };
  rawDocumentId: string | null;
  now: string;
  /**
   * Update this record instead of matching by (sourceId, sourceKey) — used when a more
   * authoritative source supersedes a record first created by a weaker source.
   */
  supersedeId: string | null;
}

export interface PublishOutcome {
  id: string;
  slug: string;
  outcome: 'created' | 'updated' | 'unchanged';
}

export interface ProvenanceInput {
  sourceId: string;
  sourceUrl: string;
  sourceKey: string;
  rawDocumentId: string | null;
  role: ProvenanceRole;
  seenAt: string;
}

export interface RunCounters {
  discovered: number;
  fetched: number;
  new: number;
  updated: number;
  unchanged: number;
  failed: number;
  skipped: number;
}

export function emptyCounters(): RunCounters {
  return { discovered: 0, fetched: 0, new: 0, updated: 0, unchanged: 0, failed: 0, skipped: 0 };
}

export interface StartRunInput {
  adapterId: string;
  sourceId: string;
  gameId: string;
  trigger: IngestionTrigger;
  mode: CollectorMode;
  now: string;
  /** A RUNNING run older than this is considered abandoned and no longer blocks new runs. */
  staleAfterMs: number;
}

export interface IngestionRunRecord {
  id: string;
  adapterId: string;
  sourceId: string;
  gameId: string;
  trigger: IngestionTrigger;
  mode: CollectorMode;
  status: IngestionRunStatus;
  startedAt: string;
  finishedAt: string | null;
  counters: RunCounters;
  error: string | null;
}

export interface FinishRunInput {
  status: Exclude<IngestionRunStatus, 'RUNNING'>;
  counters: RunCounters;
  error: string | null;
  finishedAt: string;
}

export interface SyncCounts {
  created: number;
  updated: number;
  unchanged: number;
}

export interface IngestionStore {
  syncGames(games: readonly GameConfig[], now: string): Promise<SyncCounts>;
  syncSources(sources: readonly SourceDefinition[], now: string): Promise<SyncCounts>;
  syncResetRules(rules: readonly ResetRuleDefinition[], now: string): Promise<SyncCounts>;

  /** Atomically starts a run; returns null when another non-stale run holds the adapter lock. */
  startRun(input: StartRunInput): Promise<IngestionRunRecord | null>;
  finishRun(runId: string, input: FinishRunInput): Promise<void>;
  listRuns(limit: number): Promise<IngestionRunRecord[]>;

  findLatestRawDocument(sourceId: string, documentKey: string): Promise<StoredRawDocument | null>;
  insertRawDocument(input: RawDocumentInput): Promise<{ id: string }>;
  /** Records that an unchanged document was re-checked. */
  touchRawDocument(id: string, checkedAt: string): Promise<void>;
  /** Deletes stored raw text older than the cutoff, keeping hashes and metadata. */
  pruneRawText(olderThan: string): Promise<number>;
  /**
   * Enforces a source's data-retention limit (terms-imposed TTL): deletes the content it owns
   * that no run has confirmed since the cutoff, and its raw documents (with derived parse
   * results) not re-checked since the cutoff.
   */
  expireSourceData(
    sourceId: string,
    notSeenSince: string,
  ): Promise<{ content: number; rawDocuments: number }>;

  findParseResult(
    inputHash: string,
    parserId: string,
    parserVersion: string,
  ): Promise<{ output: JsonValue | null } | null>;
  insertParseResult(input: ParseResultInput): Promise<void>;

  insertValidationResults(results: readonly ValidationResultInput[]): Promise<void>;

  findContentBySourceKey(sourceId: string, sourceKey: string): Promise<ExistingContentRef | null>;
  findContentBySemanticKey(gameId: string, semanticKey: string): Promise<ExistingContentRef[]>;
  publishContent(input: PublishInput): Promise<PublishOutcome>;
  recordProvenance(contentId: string, input: ProvenanceInput): Promise<void>;
}

export type ContentOrder = 'recent' | 'start';

export interface ContentQuery {
  gameIds?: readonly string[];
  types?: readonly ContentType[];
  /** Defaults to PUBLISHED only. */
  statuses?: readonly ContentStatus[];
  /**
   * Relevance window. Point-in-time types (PATCH, UPDATE, ANNOUNCEMENT) match when their
   * effective time falls inside; ranged types match when [startAt, endAt] overlaps.
   */
  window?: { from: string; to: string };
  includeSynthetic?: boolean;
  order?: ContentOrder;
  limit?: number;
}

export interface ContentSlugEntry {
  slug: string;
  type: ContentType;
  gameId: string;
  updatedAt: string;
  isSynthetic: boolean;
}

export interface ContentReadStore {
  listContent(query: ContentQuery): Promise<ContentRecord[]>;
  getContentBySlug(slug: string): Promise<ContentRecord | null>;
  listResetRules(gameIds?: readonly string[]): Promise<ResetRuleDefinition[]>;
  listContentSlugs(): Promise<ContentSlugEntry[]>;
  getLastUpdatedAt(gameId?: string): Promise<string | null>;
}

export type ContentStore = IngestionStore & ContentReadStore;
