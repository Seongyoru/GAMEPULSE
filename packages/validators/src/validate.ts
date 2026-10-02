/**
 * Deterministic validation engine. Runs after every parser (rule-based, AI, manual, fixture)
 * and before anything is published. AI output never bypasses these checks.
 *
 * Status semantics:
 *   VALID   — publish
 *   WARNING — publish, issues recorded (e.g. end date missing)
 *   REVIEW  — stored as PENDING_REVIEW, not public (e.g. redeem code without evidence)
 *   INVALID — rejected (e.g. endAt < startAt)
 */
import {
  DAY_MS,
  isValidTimeZone,
  normalizedCandidateSchema,
  sanitizePlainText,
  toSingleLine,
  truncateText,
  worstValidationStatus,
  zonedTimeToUtc,
  type NormalizedCandidate,
  type SourceDefinition,
  type ValidationIssue,
  type ValidationStatus,
} from '@gamepulse/domain';

export const VALIDATOR_VERSION = '1.0.0';

/** How a candidate was produced. AI output must carry verifiable evidence. */
export type ParserKind = 'deterministic' | 'ai' | 'manual' | 'fixture';

export interface ValidationContext {
  now: Date;
  source: SourceDefinition;
  parserKind: ParserKind;
  /** Plain text of the source document for evidence verification (null when unavailable). */
  documentText: string | null;
}

export interface ValidationOutcome {
  status: ValidationStatus;
  issues: ValidationIssue[];
  /** Sanitized candidate; null when the input does not satisfy the schema. */
  candidate: NormalizedCandidate | null;
}

const MAX_RANGE_MS = 366 * DAY_MS;
const MAX_FUTURE_MS = 2 * 366 * DAY_MS;
const MAX_REWARD_QUANTITY = 10_000_000;
const SYNTHETIC_CODE_PREFIX = 'GPTEST-';
const RANGED_KINDS: readonly NormalizedCandidate['kind'][] = [
  'EVENT',
  'BANNER',
  'REWARD',
  'REDEEM_CODE',
];

type Issue = ValidationIssue;
const issue = (
  severity: Issue['severity'],
  code: string,
  field: string | null,
  message: string,
): Issue => ({
  code,
  severity,
  field,
  message,
});

function sanitizeCandidate(candidate: NormalizedCandidate): NormalizedCandidate {
  const title = truncateText(toSingleLine(sanitizePlainText(candidate.title)), 200);
  const summary =
    candidate.summary === null ? null : truncateText(sanitizePlainText(candidate.summary), 600);
  return {
    ...candidate,
    title: title || candidate.title,
    summary: summary === '' ? null : summary,
  };
}

function hostAllowed(url: string, allowedHosts: readonly string[]): boolean {
  const host = new URL(url).hostname.toLowerCase();
  return allowedHosts.some((allowed) => {
    const normalized = allowed.toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

const WALL_TIME_PATTERN =
  /(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?\s*(?:\([^)]*\)\s*)?T?(\d{1,2}):(\d{2})/;

/** Parses the first "YYYY/MM/DD HH:mm"-style (or ISO "YYYY-MM-DDTHH:mm") wall time in a source string. */
export function parseSourceWallTime(
  text: string,
): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const match = WALL_TIME_PATTERN.exec(text);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return { year, month, day, hour, minute };
}

function checkTiming(candidate: NormalizedCandidate): Issue[] {
  const timing = candidate.timing;
  if (timing === null) return [];
  const issues: Issue[] = [];
  if (timing.sourceTimezone !== null && !isValidTimeZone(timing.sourceTimezone)) {
    issues.push(
      issue(
        'WARNING',
        'TIMEZONE_UNKNOWN',
        'timing.sourceTimezone',
        `Unrecognized time zone "${timing.sourceTimezone}"`,
      ),
    );
    return issues;
  }
  if (timing.sourceTimezone === null || timing.precision === 'DATE') return issues;
  const pairs: Array<['startAt' | 'endAt', string | null, string | null]> = [
    ['startAt', timing.startAtSource, candidate.startAt],
    ['endAt', timing.endAtSource, candidate.endAt],
  ];
  for (const [field, sourceText, normalized] of pairs) {
    if (sourceText === null || normalized === null) continue;
    const wall = parseSourceWallTime(sourceText);
    if (wall === null) continue;
    const expected = zonedTimeToUtc(wall, timing.sourceTimezone).getTime();
    if (expected !== Date.parse(normalized)) {
      issues.push(
        issue(
          'INVALID',
          'TIMEZONE_MISMATCH',
          field,
          `${field} ${normalized} does not match source "${sourceText}" in ${timing.sourceTimezone}`,
        ),
      );
    }
  }
  return issues;
}

function checkDates(candidate: NormalizedCandidate, now: Date): Issue[] {
  const issues: Issue[] = [];
  const start = candidate.startAt === null ? null : Date.parse(candidate.startAt);
  const end = candidate.endAt === null ? null : Date.parse(candidate.endAt);
  const nowMs = now.getTime();

  if (start !== null && end !== null && end < start) {
    issues.push(issue('INVALID', 'END_BEFORE_START', 'endAt', 'endAt is earlier than startAt'));
    return issues;
  }
  if (start !== null && end !== null && end - start > MAX_RANGE_MS) {
    issues.push(issue('REVIEW', 'RANGE_TOO_LONG', 'endAt', 'Time range longer than a year'));
  }
  if (start !== null && start - nowMs > MAX_FUTURE_MS) {
    issues.push(
      issue('REVIEW', 'START_TOO_FAR', 'startAt', 'startAt is more than two years ahead'),
    );
  }
  if (end !== null && end < nowMs) {
    issues.push(
      issue('WARNING', 'ALREADY_ENDED', 'endAt', 'Content had already ended when ingested'),
    );
  }
  if (RANGED_KINDS.includes(candidate.kind) && end === null) {
    issues.push(issue('WARNING', 'END_MISSING', 'endAt', 'End date not stated by the source'));
  }
  if (candidate.kind === 'MAINTENANCE' && start === null) {
    issues.push(issue('WARNING', 'START_MISSING', 'startAt', 'Maintenance start time not stated'));
  }
  return issues;
}

function rewardLines(candidate: NormalizedCandidate) {
  switch (candidate.kind) {
    case 'EVENT':
      return candidate.event.rewards;
    case 'REWARD':
      return candidate.reward.items;
    case 'REDEEM_CODE':
      return candidate.redeemCode.items;
    default:
      return [];
  }
}

function checkRewards(candidate: NormalizedCandidate): Issue[] {
  return rewardLines(candidate)
    .filter((line) => line.quantity !== null && line.quantity > MAX_REWARD_QUANTITY)
    .map((line) =>
      issue(
        'REVIEW',
        'REWARD_QUANTITY_IMPLAUSIBLE',
        'rewards',
        `Implausible quantity for "${line.name}"`,
      ),
    );
}

function checkPatch(candidate: NormalizedCandidate): Issue[] {
  if (candidate.kind !== 'PATCH') return [];
  const issues: Issue[] = [];
  candidate.patch.changes.forEach((change, index) => {
    const field = `patch.changes.${index}`;
    if (change.beforeValue !== null && change.beforeValue === change.afterValue) {
      issues.push(
        issue(
          'WARNING',
          'PATCH_VALUE_UNCHANGED',
          field,
          `${change.targetName}: before equals after`,
        ),
      );
    }
    if (
      (change.beforeValue === null) !== (change.afterValue === null) &&
      change.changeType !== 'NEW' &&
      change.changeType !== 'REMOVED'
    ) {
      issues.push(
        issue(
          'WARNING',
          'PATCH_VALUE_HALF_PAIR',
          field,
          `${change.targetName}: only one of before/after given`,
        ),
      );
    }
    if (
      change.field !== null &&
      change.beforeValue === null &&
      change.afterValue === null &&
      change.description === null
    ) {
      issues.push(
        issue(
          'WARNING',
          'PATCH_CHANGE_EMPTY',
          field,
          `${change.targetName}: changed field without values`,
        ),
      );
    }
  });
  return issues;
}

function checkSynthetic(candidate: NormalizedCandidate, source: SourceDefinition): Issue[] {
  const issues: Issue[] = [];
  if (source.type === 'FIXTURE' && !candidate.isSynthetic) {
    issues.push(
      issue(
        'INVALID',
        'FIXTURE_NOT_SYNTHETIC',
        'isSynthetic',
        'Fixture content must be marked synthetic',
      ),
    );
  }
  if (source.type !== 'FIXTURE' && candidate.isSynthetic) {
    issues.push(
      issue(
        'INVALID',
        'SYNTHETIC_FROM_REAL_SOURCE',
        'isSynthetic',
        'Synthetic content from a non-fixture source',
      ),
    );
  }
  if (
    candidate.kind === 'REDEEM_CODE' &&
    candidate.isSynthetic &&
    !candidate.redeemCode.code.toUpperCase().startsWith(SYNTHETIC_CODE_PREFIX)
  ) {
    issues.push(
      issue(
        'INVALID',
        'SYNTHETIC_CODE_UNMARKED',
        'redeemCode.code',
        `Synthetic codes must start with ${SYNTHETIC_CODE_PREFIX}`,
      ),
    );
  }
  return issues;
}

const normalizeForMatch = (text: string) =>
  text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

function checkEvidence(candidate: NormalizedCandidate, context: ValidationContext): Issue[] {
  const issues: Issue[] = [];
  const documentText =
    context.documentText === null ? null : normalizeForMatch(context.documentText);

  if (candidate.kind === 'REDEEM_CODE' && !candidate.isSynthetic) {
    const code = candidate.redeemCode.code.toLowerCase();
    const backed = candidate.evidence.some((entry) =>
      normalizeForMatch(entry.excerpt).includes(code),
    );
    if (!backed) {
      issues.push(
        issue(
          'REVIEW',
          'CODE_WITHOUT_EVIDENCE',
          'redeemCode.code',
          'Redeem code without official evidence',
        ),
      );
    }
  }

  if (context.parserKind !== 'ai') return issues;

  if (candidate.evidence.length === 0) {
    issues.push(
      issue(
        'REVIEW',
        'AI_WITHOUT_EVIDENCE',
        null,
        'AI output without evidence is never auto-published',
      ),
    );
    return issues;
  }
  const covered = new Set(candidate.evidence.map((entry) => entry.field.split('.')[0]));
  for (const field of ['startAt', 'endAt'] as const) {
    if (candidate[field] !== null && !covered.has(field)) {
      issues.push(
        issue('REVIEW', 'AI_FIELD_WITHOUT_EVIDENCE', field, `${field} has no supporting excerpt`),
      );
    }
  }
  if (documentText !== null) {
    for (const entry of candidate.evidence) {
      if (!documentText.includes(normalizeForMatch(entry.excerpt))) {
        issues.push(
          issue(
            'REVIEW',
            'EVIDENCE_NOT_IN_SOURCE',
            entry.field,
            'Evidence excerpt not found in the source text',
          ),
        );
      }
    }
  }
  return issues;
}

export function validateCandidate(input: unknown, context: ValidationContext): ValidationOutcome {
  const parsed = normalizedCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'INVALID',
      candidate: null,
      issues: parsed.error.issues.map((zodIssue) =>
        issue('INVALID', 'SCHEMA', zodIssue.path.join('.') || null, zodIssue.message),
      ),
    };
  }
  const candidate = sanitizeCandidate(parsed.data);
  const { source } = context;
  const issues: Issue[] = [];

  if (candidate.gameId !== source.gameId) {
    issues.push(
      issue(
        'INVALID',
        'SOURCE_GAME_MISMATCH',
        'gameId',
        `Source ${source.id} belongs to ${source.gameId}`,
      ),
    );
  }
  if (!source.contentTypes.includes(candidate.kind)) {
    issues.push(
      issue(
        'REVIEW',
        'UNEXPECTED_CONTENT_TYPE',
        'kind',
        `${source.id} is not expected to publish ${candidate.kind}`,
      ),
    );
  }
  if (!hostAllowed(candidate.sourceUrl, source.allowedHosts)) {
    issues.push(
      issue(
        'REVIEW',
        'SOURCE_URL_HOST',
        'sourceUrl',
        'Source URL host is not on the allowlist for this source',
      ),
    );
  } else if (candidate.sourceUrl.startsWith('http:')) {
    issues.push(issue('WARNING', 'SOURCE_URL_INSECURE', 'sourceUrl', 'Source URL is not HTTPS'));
  }

  issues.push(
    ...checkDates(candidate, context.now),
    ...checkTiming(candidate),
    ...checkRewards(candidate),
    ...checkPatch(candidate),
    ...checkSynthetic(candidate, source),
    ...checkEvidence(candidate, context),
  );

  const status = issues.reduce<ValidationStatus>(
    (worst, entry) => worstValidationStatus(worst, entry.severity),
    'VALID',
  );
  return { status, issues, candidate };
}
