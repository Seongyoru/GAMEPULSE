/**
 * Relative time expressions for fixture files, so synthetic data stays "current" on any day.
 *
 *   "@now"            the anchor instant
 *   "@+2d", "@-3h30m" anchor ± a duration (d/h/m units)
 *   "@+3d/10:00"      local calendar date of the anchor (in the fixture's zone) ± 3 days, at 10:00
 *   ISO-8601          absolute instant, passed through (normalized to UTC)
 *
 * Expressions are resolved when a fixture document is *fetched*, so the raw document hash
 * changes when the anchor changes (the fixture "source" publishes fresh data) and stays
 * identical for repeated runs with the same anchor (idempotent re-ingestion).
 */
import { addDays, toCalendarDate, zonedTimeToUtc } from '@gamepulse/domain';

export class FixtureError extends Error {
  override name = 'FixtureError';
}

const DURATION = /^@([+-])((?:\d+[dhm])+)$/;
const DAY_AT = /^@([+-]\d+)d\/(\d{1,2}):(\d{2})$/;
const UNIT_MS: Readonly<Record<string, number>> = { d: 86_400_000, h: 3_600_000, m: 60_000 };

export const FIXTURE_TIME_KEYS = new Set([
  'startAt',
  'endAt',
  'publishedAt',
  'sourcePublishedAt',
  'releaseAt',
]);

export function resolveRelativeTime(expression: string, anchor: Date, timeZone: string): string {
  const value = expression.trim();
  if (value === '@now') return anchor.toISOString();

  const duration = DURATION.exec(value);
  if (duration) {
    let total = 0;
    for (const [, amount, unit] of (duration[2] ?? '').matchAll(/(\d+)([dhm])/g)) {
      total += Number(amount) * (UNIT_MS[unit ?? ''] ?? 0);
    }
    return new Date(anchor.getTime() + (duration[1] === '-' ? -total : total)).toISOString();
  }

  const dayAt = DAY_AT.exec(value);
  if (dayAt) {
    const hour = Number(dayAt[2]);
    const minute = Number(dayAt[3]);
    if (hour > 23 || minute > 59) throw new FixtureError(`Invalid time in "${expression}"`);
    const date = addDays(toCalendarDate(anchor, timeZone), Number(dayAt[1]));
    return zonedTimeToUtc({ ...date, hour, minute }, timeZone).toISOString();
  }

  if (value.startsWith('@'))
    throw new FixtureError(`Unknown relative time expression "${expression}"`);
  const absolute = Date.parse(value);
  if (!Number.isFinite(absolute)) throw new FixtureError(`Invalid date "${expression}"`);
  return new Date(absolute).toISOString();
}

/** Deeply resolves relative expressions found under well-known time keys. */
export function materializeTimes(value: unknown, anchor: Date, timeZone: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => materializeTimes(entry, anchor, timeZone));
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] =
      FIXTURE_TIME_KEYS.has(key) && typeof entry === 'string'
        ? resolveRelativeTime(entry, anchor, timeZone)
        : materializeTimes(entry, anchor, timeZone);
  }
  return out;
}

/** Default fixture anchor: the current hour (stable within the hour → idempotent re-runs). */
export function defaultFixtureAnchor(now: Date = new Date()): Date {
  const anchor = new Date(now);
  anchor.setUTCMinutes(0, 0, 0);
  return anchor;
}
