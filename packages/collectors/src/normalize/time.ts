/**
 * Source date-time normalization shared by live adapters.
 *
 * Values with an explicit offset ("Z", "+09:00") are honoured as written. Offset-less values
 * are interpreted in the zone declared by the *source policy* (e.g. the Lost Ark KR Open API
 * serves Korean service times) — adapters never guess a zone per item.
 */
import { zonedTimeToUtc } from '@gamepulse/domain';

const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?)?$/;

/** Years at or beyond this are "no end" sentinels (e.g. 9999-12-31), not real dates. */
const SENTINEL_YEAR = 9000;

export interface SourceDateTime {
  /** Normalized UTC instant. */
  iso: string;
  /** The value exactly as the source wrote it (kept for audit and validation). */
  sourceText: string;
}

export function parseSourceDateTime(
  value: string | null | undefined,
  defaultZone: string,
): SourceDateTime | null {
  if (value === null || value === undefined) return null;
  const text = value.trim();
  if (text === '') return null;

  if (OFFSET_SUFFIX.test(text)) {
    const ms = Date.parse(text);
    if (Number.isNaN(ms) || new Date(ms).getUTCFullYear() >= SENTINEL_YEAR) return null;
    return { iso: new Date(ms).toISOString(), sourceText: text };
  }

  const match = LOCAL_DATE_TIME.exec(text);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map((part) => (part === undefined ? 0 : Number(part))) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (year >= SENTINEL_YEAR) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  const instant = zonedTimeToUtc({ year, month, day, hour, minute, second }, defaultZone);
  return { iso: instant.toISOString(), sourceText: text };
}
