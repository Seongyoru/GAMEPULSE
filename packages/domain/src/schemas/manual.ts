/**
 * Manual ingestion file format (`pnpm ingest:manual <file.json>`): the administrator
 * fallback when a collector is unavailable. Items are NormalizedCandidates with
 * conveniences filled in; every item must still cite an official sourceUrl.
 */
import { z } from 'zod';
import { stableStringify, fnv1a32 } from '../identity';
import { normalizedCandidateSchema, type NormalizedCandidate } from './candidate';

export const manualIngestionFileSchema = z.object({
  gameId: z.string().min(1),
  /** Optional free-form note on who prepared the file and why (stored in run logs). */
  note: z.string().max(500).optional(),
  items: z.array(z.record(z.string(), z.unknown())).min(1).max(200),
});
export type ManualIngestionFile = z.infer<typeof manualIngestionFileSchema>;

export interface ManualItemError {
  index: number;
  issues: string[];
}

/** Fills defaults for convenience fields; required facts (kind, title, sourceUrl…) stay required. */
export function completeManualItem(
  raw: Record<string, unknown>,
  gameId: string,
  locale: string,
): unknown {
  const draft: Record<string, unknown> = {
    slugHint: null,
    summary: null,
    startAt: null,
    endAt: null,
    timing: null,
    sourcePublishedAt: null,
    sourceLocale: locale,
    priority: 50,
    confidence: 1,
    evidence: [],
    isSynthetic: false,
    metadata: null,
    ...raw,
    gameId,
  };
  if (typeof draft.sourceKey !== 'string' || draft.sourceKey === '') {
    const identity = stableStringify({
      kind: draft.kind,
      title: draft.title,
      startAt: draft.startAt,
    });
    draft.sourceKey = `manual-${fnv1a32(identity)}`;
  }
  return draft;
}

export function parseManualItems(
  file: ManualIngestionFile,
  locale: string,
): { candidates: NormalizedCandidate[]; errors: ManualItemError[] } {
  const candidates: NormalizedCandidate[] = [];
  const errors: ManualItemError[] = [];
  file.items.forEach((raw, index) => {
    const parsed = normalizedCandidateSchema.safeParse(
      completeManualItem(raw, file.gameId, locale),
    );
    if (parsed.success) {
      candidates.push(parsed.data);
    } else {
      errors.push({
        index,
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        ),
      });
    }
  });
  return { candidates, errors };
}
