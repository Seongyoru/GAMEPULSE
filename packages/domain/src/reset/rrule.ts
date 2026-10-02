/**
 * RFC 5545 RRULE subset used for CUSTOM_RRULE reset rules.
 *
 * Supported: FREQ (DAILY | WEEKLY | MONTHLY), INTERVAL, BYDAY (ordinals only with MONTHLY),
 * BYMONTHDAY (MONTHLY only, negative = from month end), BYHOUR, BYMINUTE, UNTIL, WKST=MO.
 * Anything else throws RRuleError — an unsupported rule must fail loudly, never be
 * silently mis-computed.
 */

export type RRuleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RRuleByDay {
  /** ISO weekday 1 (Mon) … 7 (Sun). */
  weekday: number;
  /** nth occurrence within the month (1..5, -1..-5); null = every such weekday. */
  ordinal: number | null;
}

export interface ParsedRRule {
  freq: RRuleFrequency;
  interval: number;
  byDay: RRuleByDay[];
  byMonthDay: number[];
  byHour: number[];
  byMinute: number[];
  until: Date | null;
}

export class RRuleError extends Error {
  override name = 'RRuleError';
}

export const WEEKDAY_CODES: Readonly<Record<string, number>> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

const SUPPORTED_KEYS = new Set([
  'FREQ',
  'INTERVAL',
  'BYDAY',
  'BYMONTHDAY',
  'BYHOUR',
  'BYMINUTE',
  'UNTIL',
  'WKST',
]);

function parseIntList(key: string, value: string, min: number, max: number): number[] {
  return value.split(',').map((token) => {
    if (!/^[+-]?\d+$/.test(token)) throw new RRuleError(`${key}: "${token}" is not an integer`);
    const n = Number(token);
    if (n < min || n > max || (n === 0 && min < 0)) {
      throw new RRuleError(`${key}: ${n} is out of range`);
    }
    return n;
  });
}

function parseUntil(value: string): Date {
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(
      Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 23, 59, 59),
    );
  }
  const utc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (utc) {
    return new Date(
      Date.UTC(
        Number(utc[1]),
        Number(utc[2]) - 1,
        Number(utc[3]),
        Number(utc[4]),
        Number(utc[5]),
        Number(utc[6]),
      ),
    );
  }
  throw new RRuleError(`UNTIL must be YYYYMMDD or YYYYMMDDTHHMMSSZ (UTC), got "${value}"`);
}

export function parseRRule(input: string): ParsedRRule {
  const body = input.trim().replace(/^RRULE:/i, '');
  if (body === '') throw new RRuleError('Empty RRULE');

  const parts = new Map<string, string>();
  for (const segment of body.split(';')) {
    if (segment === '') continue;
    const [rawKey, value] = segment.split('=');
    const key = rawKey?.toUpperCase();
    if (!key || value === undefined || value === '') {
      throw new RRuleError(`Malformed RRULE segment "${segment}"`);
    }
    if (!SUPPORTED_KEYS.has(key)) throw new RRuleError(`Unsupported RRULE part: ${key}`);
    if (parts.has(key)) throw new RRuleError(`Duplicate RRULE part: ${key}`);
    parts.set(key, value.toUpperCase());
  }

  const freq = parts.get('FREQ');
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') {
    throw new RRuleError(`FREQ must be DAILY, WEEKLY or MONTHLY (got ${freq ?? 'nothing'})`);
  }

  const wkst = parts.get('WKST');
  if (wkst !== undefined && wkst !== 'MO') throw new RRuleError('Only WKST=MO is supported');

  const intervalRaw = parts.get('INTERVAL');
  const interval = intervalRaw === undefined ? 1 : Number(intervalRaw);
  if (!Number.isInteger(interval) || interval < 1 || interval > 366) {
    throw new RRuleError(`INTERVAL must be a positive integer (got ${intervalRaw})`);
  }

  const byDay: RRuleByDay[] = [];
  const byDayRaw = parts.get('BYDAY');
  if (byDayRaw !== undefined) {
    for (const token of byDayRaw.split(',')) {
      const match = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(token);
      if (!match) throw new RRuleError(`BYDAY: invalid token "${token}"`);
      const ordinal = match[1] === undefined ? null : Number(match[1]);
      if (ordinal !== null) {
        if (freq !== 'MONTHLY')
          throw new RRuleError('BYDAY ordinals are only supported with FREQ=MONTHLY');
        if (ordinal === 0 || Math.abs(ordinal) > 5)
          throw new RRuleError(`BYDAY: ordinal ${ordinal} out of range`);
      }
      byDay.push({ weekday: WEEKDAY_CODES[match[2] as string] ?? 0, ordinal });
    }
    if (freq === 'DAILY') throw new RRuleError('BYDAY is not supported with FREQ=DAILY');
  }

  const byMonthDayRaw = parts.get('BYMONTHDAY');
  const byMonthDay =
    byMonthDayRaw === undefined ? [] : parseIntList('BYMONTHDAY', byMonthDayRaw, -31, 31);
  if (byMonthDay.length > 0 && freq !== 'MONTHLY') {
    throw new RRuleError('BYMONTHDAY is only supported with FREQ=MONTHLY');
  }

  const byHourRaw = parts.get('BYHOUR');
  const byMinuteRaw = parts.get('BYMINUTE');
  const untilRaw = parts.get('UNTIL');

  return {
    freq,
    interval,
    byDay,
    byMonthDay,
    byHour: byHourRaw === undefined ? [] : parseIntList('BYHOUR', byHourRaw, 0, 23),
    byMinute: byMinuteRaw === undefined ? [] : parseIntList('BYMINUTE', byMinuteRaw, 0, 59),
    until: untilRaw === undefined ? null : parseUntil(untilRaw),
  };
}
