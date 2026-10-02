/**
 * Reference semantics of ContentQuery. The in-memory store uses these functions directly;
 * the PostgreSQL store implements the same rules in SQL and the shared contract tests
 * assert both behave identically.
 */
import type { ContentRecord } from './content';
import type { ContentType } from './enums';
import type { ContentOrder, ContentQuery } from './ports';
import { toEpochMs } from './time/zone';

/** Types that describe a moment (release/publication) rather than a time range. */
export const POINT_IN_TIME_TYPES: readonly ContentType[] = ['PATCH', 'UPDATE', 'ANNOUNCEMENT'];

type TimeFields = Pick<ContentRecord, 'type' | 'startAt' | 'endAt' | 'sourcePublishedAt' | 'publishedAt'>;

/** startAt ?? sourcePublishedAt ?? publishedAt, as epoch ms. */
export function effectiveTimeMs(record: Omit<TimeFields, 'type' | 'endAt'>): number {
  return (
    toEpochMs(record.startAt) ??
    toEpochMs(record.sourcePublishedAt) ??
    toEpochMs(record.publishedAt) ??
    0
  );
}

export function isPointInTime(record: TimeFields): boolean {
  return POINT_IN_TIME_TYPES.includes(record.type) || (record.startAt === null && record.endAt === null);
}

export function matchesWindow(record: TimeFields, window: { from: string; to: string }): boolean {
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  if (isPointInTime(record)) {
    const at = effectiveTimeMs(record);
    return at >= from && at <= to;
  }
  const start = toEpochMs(record.startAt);
  const end = toEpochMs(record.endAt);
  return (end === null || end >= from) && (start === null || start <= to);
}

export function matchesContentQuery(record: ContentRecord, query: ContentQuery): boolean {
  const statuses = query.statuses ?? ['PUBLISHED'];
  if (!statuses.includes(record.status)) return false;
  if (query.gameIds && !query.gameIds.includes(record.gameId)) return false;
  if (query.types && !query.types.includes(record.type)) return false;
  if (query.includeSynthetic === false && record.isSynthetic) return false;
  if (query.window && !matchesWindow(record, query.window)) return false;
  return true;
}

/** Byte-order string comparison (matches PostgreSQL's uuid ordering for tie-breaks). */
function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function compareContent(order: ContentOrder): (a: ContentRecord, b: ContentRecord) => number {
  if (order === 'start') {
    return (a, b) => effectiveTimeMs(a) - effectiveTimeMs(b) || compareIds(a.id, b.id);
  }
  return (a, b) => effectiveTimeMs(b) - effectiveTimeMs(a) || compareIds(a.id, b.id);
}

export function applyContentQuery(records: readonly ContentRecord[], query: ContentQuery): ContentRecord[] {
  const filtered = records.filter((record) => matchesContentQuery(record, query));
  filtered.sort(compareContent(query.order ?? 'recent'));
  return query.limit === undefined ? filtered : filtered.slice(0, query.limit);
}
