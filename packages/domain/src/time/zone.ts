/**
 * Time-zone utilities built on Intl only (no dependencies; identical in browsers and Node).
 *
 * Accepted zone identifiers:
 *   - IANA names: "Asia/Seoul", "America/New_York", "Etc/GMT-8"
 *   - Fixed offsets as written by publishers: "UTC", "UTC+8", "UTC+08:00", "GMT-5", "+09:00"
 *
 * All instants are JavaScript Dates (UTC). Wall-clock values are plain objects.
 */
import { DAY_MS, MINUTE_MS } from '../constants';

export interface WallTime {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface CalendarDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

export interface WallTimeInput {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}

const FIXED_OFFSET_PATTERN = /^(?:UTC|GMT)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i;

/** Returns minutes east of UTC for fixed-offset identifiers, or null for IANA names. */
export function parseFixedOffset(timeZone: string): number | null {
  const tz = timeZone.trim();
  if (/^(?:UTC|GMT|Z|Etc\/UTC|Etc\/GMT)$/i.test(tz)) return 0;
  const match = FIXED_OFFSET_PATTERN.exec(tz);
  if (!match) return null;
  const [, sign, hours, minutes] = match;
  const h = Number(hours);
  const m = minutes === undefined ? 0 : Number(minutes);
  if (h > 14 || m > 59) return null;
  const total = h * 60 + m;
  return sign === '-' ? -total : total;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') return false;
  if (parseFixedOffset(timeZone) !== null) return true;
  try {
    getPartsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function assertValidTimeZone(timeZone: string): void {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Invalid time zone: "${timeZone}"`);
  }
}

/** Wall-clock reading of an instant in a zone. */
export function getWallTime(instant: Date, timeZone: string): WallTime {
  const fixed = parseFixedOffset(timeZone);
  if (fixed !== null) {
    const shifted = new Date(instant.getTime() + fixed * MINUTE_MS);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
    };
  }
  const values: Record<string, number> = {};
  for (const part of getPartsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? NaN,
    month: values.month ?? NaN,
    day: values.day ?? NaN,
    hour: (values.hour ?? NaN) % 24,
    minute: values.minute ?? NaN,
    second: values.second ?? NaN,
  };
}

/** Offset (minutes east of UTC) in effect for the zone at the given instant. */
export function getOffsetMinutes(instant: Date, timeZone: string): number {
  const fixed = parseFixedOffset(timeZone);
  if (fixed !== null) return fixed;
  const wall = getWallTime(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / MINUTE_MS);
}

function wallMatches(actual: WallTime, expected: Required<WallTimeInput>): boolean {
  return (
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute
  );
}

/**
 * Converts a wall-clock time in a zone into a UTC instant.
 *
 * Disambiguation follows Temporal's "compatible" mode:
 *   - a wall time inside a DST gap is moved forward by the length of the gap;
 *   - an ambiguous wall time (DST overlap) resolves to the earlier instant.
 */
export function zonedTimeToUtc(input: WallTimeInput, timeZone: string): Date {
  const wall: Required<WallTimeInput> = {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour ?? 0,
    minute: input.minute ?? 0,
    second: input.second ?? 0,
  };
  const naiveUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  const fixed = parseFixedOffset(timeZone);
  if (fixed !== null) return new Date(naiveUtc - fixed * MINUTE_MS);

  const offsetBefore = getOffsetMinutes(new Date(naiveUtc - DAY_MS), timeZone);
  const offsetAfter = getOffsetMinutes(new Date(naiveUtc + DAY_MS), timeZone);
  const candidates = [...new Set([offsetBefore, offsetAfter])]
    .map((offset) => naiveUtc - offset * MINUTE_MS)
    .filter((instant) => wallMatches(getWallTime(new Date(instant), timeZone), wall));

  if (candidates.length > 0) return new Date(Math.min(...candidates));
  // Wall time falls into a gap: interpret with the pre-transition offset (moves it forward).
  return new Date(naiveUtc - offsetBefore * MINUTE_MS);
}

/** Calendar date of an instant in a zone. */
export function toCalendarDate(instant: Date, timeZone: string): CalendarDate {
  const { year, month, day } = getWallTime(instant, timeZone);
  return { year, month, day };
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1 + months, 1));
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

/** Whole calendar days from a to b (positive when b is later). */
export function calendarDayDiff(a: CalendarDate, b: CalendarDate): number {
  const aMs = Date.UTC(a.year, a.month - 1, a.day);
  const bMs = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bMs - aMs) / DAY_MS);
}

export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  return calendarDayDiff(b, a);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: CalendarDate): number {
  const jsDay = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday of the ISO week containing the date. */
export function startOfIsoWeek(date: CalendarDate): CalendarDate {
  return addDays(date, 1 - isoWeekday(date));
}

/** UTC instant of local midnight for a calendar date in a zone. */
export function startOfDay(date: CalendarDate, timeZone: string): Date {
  return zonedTimeToUtc({ ...date, hour: 0, minute: 0, second: 0 }, timeZone);
}

export function formatCalendarDate(date: CalendarDate): string {
  const mm = String(date.month).padStart(2, '0');
  const dd = String(date.day).padStart(2, '0');
  return `${String(date.year).padStart(4, '0')}-${mm}-${dd}`;
}

export function parseCalendarDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Invalid calendar date: "${value}"`);
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (date.month < 1 || date.month > 12 || date.day < 1) {
    throw new RangeError(`Invalid calendar date: "${value}"`);
  }
  if (date.day > daysInMonth(date.year, date.month)) {
    throw new RangeError(`Invalid calendar date: "${value}"`);
  }
  return date;
}

/** "UTC+9", "UTC-5", "UTC+5:30", "UTC". */
export function formatUtcOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'UTC';
  const sign = offsetMinutes > 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
}

/** Offset label for a zone at an instant, e.g. "UTC+9" for Asia/Seoul. */
export function describeTimeZone(timeZone: string, at: Date = new Date()): string {
  return formatUtcOffset(getOffsetMinutes(at, timeZone));
}

/** Parses an ISO-8601 string or Date into epoch milliseconds; null for null/invalid input. */
export function toEpochMs(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
