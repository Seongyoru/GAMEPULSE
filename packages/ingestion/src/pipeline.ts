/**
 * The ingestion pipeline:
 *
 *   DISCOVER → FETCH → RAW DOCUMENT → PARSE/NORMALIZE → VALIDATE → DEDUPLICATE → PUBLISH
 *
 * Guarantees:
 *   - idempotent: unchanged documents (same content hash) are not re-parsed; unchanged
 *     candidates are not rewritten; re-runs never duplicate content
 *   - one run per adapter at a time (store-level run lock)
 *   - a failing source never deletes previously valid content; failures are recorded
 *   - weaker sources never overwrite stronger ones (official > manual > fallback > fixture)
 */
import { createHash } from 'node:crypto';
import type { FetchedDocument, NormalizeResult, SourceAdapter } from '@gamepulse/collectors';
import {
  buildContentSlug,
  documentKey,
  emptyCounters,
  requireGame,
  semanticKey,
  SOURCE_TYPE_AUTHORITY,
  stableStringify,
  type ExistingContentRef,
  type IngestionRunStatus,
  type IngestionStore,
  type IngestionTrigger,
  type NormalizedCandidate,
  type RunCounters,
  type SourceType,
  type ValidationResultInput,
  type ValidationStatus,
} from '@gamepulse/domain';
import { errorMessage, type ErrorReporter, type Logger } from '@gamepulse/observability';
import { decidePublication, validateCandidate, VALIDATOR_VERSION } from '@gamepulse/validators';

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export interface IngestionDependencies {
  store: IngestionStore;
  logger: Logger;
  errorReporter?: ErrorReporter;
  clock?: () => Date;
}

export interface IngestionOptions {
  trigger: IngestionTrigger;
  /** Re-parse documents even when their content hash is unchanged. */
  force?: boolean;
  /** A RUNNING run older than this no longer blocks a new run (crashed worker). */
  staleRunAfterMs?: number;
}

export type CandidateOutcome =
  'created' | 'updated' | 'unchanged' | 'duplicate' | 'review-held' | 'rejected';
export type IngestionStage = 'discover' | 'fetch' | 'normalize' | 'publish';

export interface IngestionReport {
  adapterId: string;
  gameId: string;
  sourceId: string;
  runId: string | null;
  status: IngestionRunStatus | 'SKIPPED_LOCKED';
  counters: RunCounters;
  validation: Record<ValidationStatus, number>;
  outcomes: Record<CandidateOutcome, number>;
  errors: Array<{ stage: IngestionStage; url: string | null; message: string }>;
  warnings: string[];
  durationMs: number;
}

const DEFAULT_STALE_RUN_MS = 30 * 60 * 1000;

function isMoreAuthoritative(candidate: SourceType, existing: SourceType): boolean {
  return SOURCE_TYPE_AUTHORITY[candidate] < SOURCE_TYPE_AUTHORITY[existing];
}

class StageError extends Error {
  constructor(
    readonly stage: IngestionStage,
    readonly url: string | null,
    cause: unknown,
  ) {
    super(errorMessage(cause), { cause });
  }
}

export async function runIngestion(
  adapter: SourceAdapter,
  deps: IngestionDependencies,
  options: IngestionOptions,
): Promise<IngestionReport> {
  const clock = deps.clock ?? (() => new Date());
  const startedAt = clock();
  const { source } = adapter;
  const game = requireGame(adapter.gameId);
  const report: IngestionReport = {
    adapterId: adapter.id,
    gameId: adapter.gameId,
    sourceId: source.id,
    runId: null,
    status: 'RUNNING',
    counters: emptyCounters(),
    validation: { VALID: 0, WARNING: 0, REVIEW: 0, INVALID: 0 },
    outcomes: { created: 0, updated: 0, unchanged: 0, duplicate: 0, 'review-held': 0, rejected: 0 },
    errors: [],
    warnings: [],
    durationMs: 0,
  };
  const elapsed = () => clock().getTime() - startedAt.getTime();

  const run = await deps.store.startRun({
    adapterId: adapter.id,
    sourceId: source.id,
    gameId: adapter.gameId,
    trigger: options.trigger,
    mode: adapter.mode,
    now: startedAt.toISOString(),
    staleAfterMs: options.staleRunAfterMs ?? DEFAULT_STALE_RUN_MS,
  });
  const baseLog = deps.logger.child({ adapter: adapter.id, game: adapter.gameId });
  if (!run) {
    report.status = 'SKIPPED_LOCKED';
    report.durationMs = elapsed();
    baseLog.warn('ingestion skipped: another run holds the adapter lock', {
      status: 'SKIPPED_LOCKED',
      duration: report.durationMs,
    });
    return report;
  }
  report.runId = run.id;
  const log = baseLog.child({ runId: run.id });
  const { counters } = report;
  log.info('ingestion started', {
    trigger: options.trigger,
    mode: adapter.mode,
    sourceUrl: source.homepageUrl,
    status: 'RUNNING',
  });

  const recordValidation = async (
    input: Omit<
      ValidationResultInput,
      'ingestionRunId' | 'sourceId' | 'validatorVersion' | 'createdAt'
    >,
  ) => {
    await deps.store.insertValidationResults([
      {
        ...input,
        ingestionRunId: run.id,
        sourceId: source.id,
        validatorVersion: VALIDATOR_VERSION,
        createdAt: clock().toISOString(),
      },
    ]);
  };

  const processCandidate = async (
    candidate: NormalizedCandidate,
    normalized: NormalizeResult,
    rawDocumentId: string,
  ): Promise<CandidateOutcome> => {
    const now = clock().toISOString();
    const validation = validateCandidate(candidate, {
      now: clock(),
      source,
      parserKind: normalized.parser.kind,
      documentText: normalized.documentText,
    });
    report.validation[validation.status] += 1;
    const base = {
      rawDocumentId,
      candidateKey: candidate.sourceKey,
      status: validation.status,
      issues: validation.issues,
    };

    if (validation.status === 'INVALID' || validation.candidate === null) {
      await recordValidation({ ...base, contentItemId: null });
      log.warn('candidate rejected by validation', {
        sourceUrl: candidate.sourceUrl,
        candidateKey: candidate.sourceKey,
        status: 'INVALID',
        issues: validation.issues.map((issue) => issue.code),
      });
      return 'rejected';
    }

    const valid = validation.candidate;
    const decision = decidePublication(validation.status, source, normalized.parser.kind);
    const semantic = semanticKey(valid);
    const supporting = {
      sourceId: source.id,
      sourceKey: valid.sourceKey,
      sourceUrl: valid.sourceUrl,
      rawDocumentId,
      role: 'SUPPORTING' as const,
      seenAt: now,
    };

    let target: ExistingContentRef | null = await deps.store.findContentBySourceKey(
      source.id,
      valid.sourceKey,
    );
    let supersedeId: string | null = null;

    if (target && target.sourceId !== source.id) {
      // This source previously reported the fact, but a stronger source now owns the record.
      if (!isMoreAuthoritative(source.type, target.sourceType)) {
        await deps.store.recordProvenance(target.id, supporting);
        await recordValidation({ ...base, contentItemId: target.id });
        return 'duplicate';
      }
      supersedeId = target.id;
    } else if (!target) {
      const others = (await deps.store.findContentBySemanticKey(valid.gameId, semantic))
        .filter((ref) => ref.sourceId !== source.id)
        .sort((a, b) => SOURCE_TYPE_AUTHORITY[a.sourceType] - SOURCE_TYPE_AUTHORITY[b.sourceType]);
      const owner = others[0];
      if (owner) {
        if (!isMoreAuthoritative(source.type, owner.sourceType)) {
          await deps.store.recordProvenance(owner.id, supporting);
          await recordValidation({ ...base, contentItemId: owner.id });
          log.debug('duplicate of a record owned by an equal or stronger source', {
            candidateKey: valid.sourceKey,
            owner: owner.sourceId,
          });
          return 'duplicate';
        }
        target = owner;
        supersedeId = owner.id;
      }
    }

    if (decision.status === 'PENDING_REVIEW' && target?.status === 'PUBLISHED') {
      // Never let a doubtful update hide content that was valid before.
      await recordValidation({ ...base, contentItemId: target.id });
      log.warn('update held for review; previous published version kept', {
        candidateKey: valid.sourceKey,
        sourceUrl: valid.sourceUrl,
        status: 'REVIEW',
      });
      return 'review-held';
    }

    const verifiedAt =
      decision.verification === 'AUTO_VERIFIED' || decision.verification === 'MANUAL_VERIFIED'
        ? now
        : null;
    const published = await deps.store.publishContent({
      candidate: valid,
      source,
      semanticKey: semantic,
      contentHash: sha256(stableStringify(valid)),
      slug: buildContentSlug({ gameSlug: game.slug, candidate: valid }),
      status: decision.status,
      verification: decision.verification,
      verifiedAt,
      validationStatus: validation.status,
      parser: { id: normalized.parser.id, version: normalized.parser.version },
      rawDocumentId,
      now,
      supersedeId,
    });
    await recordValidation({ ...base, contentItemId: published.id });
    return published.outcome;
  };

  const processDocument = async (
    fetched: FetchedDocument,
    previousId: string | null,
    hash: string,
  ) => {
    const docStarted = clock().getTime();
    const raw = await deps.store.insertRawDocument({
      sourceId: source.id,
      documentKey: documentKey({ externalId: fetched.externalId, url: fetched.url }),
      externalId: fetched.externalId,
      url: fetched.url,
      contentHash: hash,
      contentType: fetched.contentType,
      rawText: fetched.rawText,
      fetchedAt: fetched.fetchedAt,
      httpStatus: fetched.httpStatus,
      etag: fetched.etag,
      lastModified: fetched.lastModified,
      locale: fetched.locale,
      ingestionRunId: run.id,
      metadata: fetched.metadata,
    });

    let normalized: NormalizeResult;
    try {
      normalized = await adapter.normalize(fetched);
    } catch (error) {
      await deps.store.insertParseResult({
        rawDocumentId: raw.id,
        parserId: 'unknown',
        parserVersion: 'unknown',
        inputHash: hash,
        status: 'FAILED',
        output: null,
        error: errorMessage(error),
        model: null,
        usage: null,
        createdAt: clock().toISOString(),
      });
      throw new StageError('normalize', fetched.url, error);
    }

    await deps.store.insertParseResult({
      rawDocumentId: raw.id,
      parserId: normalized.parser.id,
      parserVersion: normalized.parser.version,
      inputHash: hash,
      status: 'SUCCEEDED',
      output: { candidates: normalized.candidates, warnings: normalized.warnings },
      error: null,
      model: null,
      usage: null,
      createdAt: clock().toISOString(),
    });
    for (const warning of normalized.warnings) {
      report.warnings.push(warning);
      log.warn('normalization warning', { sourceUrl: fetched.url, warning });
    }

    for (const candidate of normalized.candidates) {
      let outcome: CandidateOutcome;
      try {
        outcome = await processCandidate(candidate, normalized, raw.id);
      } catch (error) {
        throw new StageError('publish', candidate.sourceUrl, error);
      }
      report.outcomes[outcome] += 1;
      if (outcome === 'created') counters.new += 1;
      else if (outcome === 'updated') counters.updated += 1;
      else if (outcome === 'unchanged') counters.unchanged += 1;
      else if (outcome === 'rejected') counters.failed += 1;
      else counters.skipped += 1;
    }
    log.info('document processed', {
      sourceUrl: fetched.url,
      duration: clock().getTime() - docStarted,
      status: 'PROCESSED',
      candidates: normalized.candidates.length,
      replaced: previousId !== null,
    });
  };

  try {
    let resources;
    try {
      resources = await adapter.discover();
    } catch (error) {
      throw new StageError('discover', source.homepageUrl, error);
    }
    counters.discovered = resources.length;
    if (resources.length === 0) {
      report.warnings.push('discovery returned no resources');
      log.warn('discovery returned no resources', {
        sourceUrl: source.homepageUrl,
        status: 'EMPTY',
      });
    }

    for (const resource of resources) {
      const docStarted = clock().getTime();
      try {
        const key = documentKey({ externalId: resource.externalId, url: resource.url });
        const previous = await deps.store.findLatestRawDocument(source.id, key);
        let fetched: FetchedDocument;
        try {
          fetched = await adapter.fetch(
            resource,
            previous ? { etag: previous.etag, lastModified: previous.lastModified } : null,
          );
        } catch (error) {
          throw new StageError('fetch', resource.url, error);
        }
        if (fetched.notModified) {
          if (previous) await deps.store.touchRawDocument(previous.id, clock().toISOString());
          counters.unchanged += 1;
          log.debug('document not modified', {
            sourceUrl: resource.url,
            duration: clock().getTime() - docStarted,
            status: 304,
          });
          continue;
        }
        counters.fetched += 1;
        const hash = sha256(fetched.rawText);
        if (!options.force && previous?.contentHash === hash) {
          await deps.store.touchRawDocument(previous.id, clock().toISOString());
          counters.unchanged += 1;
          log.debug('document unchanged (same content hash)', {
            sourceUrl: fetched.url,
            duration: clock().getTime() - docStarted,
            status: 'UNCHANGED',
          });
          continue;
        }
        await processDocument(fetched, previous?.id ?? null, hash);
      } catch (error) {
        counters.failed += 1;
        const stageError =
          error instanceof StageError ? error : new StageError('publish', resource.url, error);
        report.errors.push({
          stage: stageError.stage,
          url: stageError.url,
          message: stageError.message,
        });
        deps.errorReporter?.captureException(stageError.cause ?? stageError, {
          tags: { adapter: adapter.id, game: adapter.gameId, stage: stageError.stage },
        });
        log.error('document failed', {
          sourceUrl: stageError.url,
          stage: stageError.stage,
          duration: clock().getTime() - docStarted,
          status: 'FAILED',
          error: stageError.cause ?? stageError,
        });
      }
    }

    const succeeded = counters.new + counters.updated + counters.unchanged + counters.skipped;
    report.status = counters.failed === 0 ? 'SUCCEEDED' : succeeded > 0 ? 'PARTIAL' : 'FAILED';
  } catch (error) {
    report.status = 'FAILED';
    const stageError =
      error instanceof StageError ? error : new StageError('discover', null, error);
    report.errors.push({
      stage: stageError.stage,
      url: stageError.url,
      message: stageError.message,
    });
    deps.errorReporter?.captureException(stageError.cause ?? stageError, {
      tags: { adapter: adapter.id, game: adapter.gameId, stage: stageError.stage },
    });
    log.error('ingestion failed; previously published content is kept', {
      sourceUrl: stageError.url,
      stage: stageError.stage,
      status: 'FAILED',
      error: stageError.cause ?? stageError,
    });
  } finally {
    report.durationMs = elapsed();
    const finalStatus =
      report.status === 'RUNNING' || report.status === 'SKIPPED_LOCKED' ? 'FAILED' : report.status;
    await deps.store.finishRun(run.id, {
      status: finalStatus,
      counters,
      error:
        report.errors.length > 0
          ? report.errors
              .map((e) => `${e.stage}: ${e.message}`)
              .join('\n')
              .slice(0, 4000)
          : null,
      finishedAt: clock().toISOString(),
    });
    log.info('ingestion finished', {
      status: finalStatus,
      duration: report.durationMs,
      sourceUrl: source.homepageUrl,
      ...counters,
    });
  }
  return report;
}
