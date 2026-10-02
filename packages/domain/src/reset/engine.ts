/**
 * Reset engine: computes occurrences of recurring reset rules on demand.
 *
 * Occurrences are evaluated on the local calendar of the rule's time zone and converted
 * to UTC with DST-aware disambiguation, so "every Wednesday 06:00 Asia/Seoul" or
 * "1st and 16th of the month 04:00 UTC+8" are exact for any viewer time zone.
 */
import type { ResetFrequency } from '../enums';
import {
  addDays,
  calendarDayDiff,
  daysInMonth,
  isoWeekday,
  startOfIsoWeek,
  toCalendarDate,
  zonedTimeToUtc,
  type CalendarDate,
} from '../time/zone';
import { parseRRule, RRuleError, type ParsedRRule } from './rrule';

/** The scheduling fields of a ResetRuleDefinition. */
export interface ResetSchedule {
  frequency: ResetFrequency;
  timezone: string;
  hour: number;
  minute: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  rrule: string | null;
  anchor: string | null;
}

interface CompiledSchedule {
  timezone: string;
  times: Array<{ hour: number; minute: number }>;
  matchesDate: (date: CalendarDate) => boolean;
  until: Date | null;
  /** First local date that can match (DTSTART), so scans never start long before it. */
  notBefore: CalendarDate | null;
  /** Max number of local days to scan when searching for the next/previous occurrence. */
  horizonDays: number;
}

const compiledCache = new Map<string, CompiledSchedule>();

function cacheKey(schedule: ResetSchedule): string {
  return [
    schedule.frequency,
    schedule.timezone,
    schedule.hour,
    schedule.minute,
    schedule.dayOfWeek,
    schedule.dayOfMonth,
    schedule.rrule,
    schedule.anchor,
  ].join('|');
}

function monthDayMatches(date: CalendarDate, monthDay: number): boolean {
  const length = daysInMonth(date.year, date.month);
  const target = monthDay > 0 ? monthDay : length + monthDay + 1;
  return date.day === target;
}

function nthWeekdayMatches(date: CalendarDate, weekday: number, ordinal: number | null): boolean {
  if (isoWeekday(date) !== weekday) return false;
  if (ordinal === null) return true;
  if (ordinal > 0) return Math.floor((date.day - 1) / 7) + 1 === ordinal;
  const fromEnd = Math.floor((daysInMonth(date.year, date.month) - date.day) / 7) + 1;
  return -fromEnd === ordinal;
}

function monthIndex(date: CalendarDate): number {
  return date.year * 12 + (date.month - 1);
}

function compileRRule(schedule: ResetSchedule, rule: ParsedRRule): CompiledSchedule {
  const anchorDate =
    schedule.anchor === null ? null : toCalendarDate(new Date(schedule.anchor), schedule.timezone);
  if (rule.interval > 1 && anchorDate === null) {
    throw new RRuleError('INTERVAL > 1 requires an anchor (DTSTART)');
  }

  const hours = rule.byHour.length > 0 ? rule.byHour : [schedule.hour];
  const minutes = rule.byMinute.length > 0 ? rule.byMinute : [schedule.minute];
  const times = hours
    .flatMap((hour) => minutes.map((minute) => ({ hour, minute })))
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  const notBeforeAnchor = (date: CalendarDate) =>
    anchorDate === null || calendarDayDiff(anchorDate, date) >= 0;

  let matchesDate: (date: CalendarDate) => boolean;
  let horizonDays: number;

  switch (rule.freq) {
    case 'DAILY':
      matchesDate = (date) =>
        notBeforeAnchor(date) &&
        (anchorDate === null || calendarDayDiff(anchorDate, date) % rule.interval === 0);
      horizonDays = rule.interval + 1;
      break;
    case 'WEEKLY': {
      const weekdays =
        rule.byDay.length > 0
          ? rule.byDay.map((d) => d.weekday)
          : [anchorDate ? isoWeekday(anchorDate) : (schedule.dayOfWeek ?? 1)];
      const anchorWeek = anchorDate ? startOfIsoWeek(anchorDate) : null;
      matchesDate = (date) => {
        if (!notBeforeAnchor(date) || !weekdays.includes(isoWeekday(date))) return false;
        if (anchorWeek === null) return true;
        const weeks = calendarDayDiff(anchorWeek, startOfIsoWeek(date)) / 7;
        return weeks % rule.interval === 0;
      };
      horizonDays = 7 * rule.interval + 1;
      break;
    }
    case 'MONTHLY': {
      const monthDays =
        rule.byMonthDay.length > 0 || rule.byDay.length > 0
          ? rule.byMonthDay
          : [anchorDate?.day ?? schedule.dayOfMonth ?? 1];
      const anchorMonth = anchorDate ? monthIndex(anchorDate) : null;
      matchesDate = (date) => {
        if (!notBeforeAnchor(date)) return false;
        if (anchorMonth !== null && (monthIndex(date) - anchorMonth) % rule.interval !== 0) return false;
        return (
          monthDays.some((day) => monthDayMatches(date, day)) ||
          rule.byDay.some((d) => nthWeekdayMatches(date, d.weekday, d.ordinal))
        );
      };
      // Long enough to skip months that lack e.g. a 31st or a 5th Friday.
      horizonDays = 31 * rule.interval * 4 + 1;
      break;
    }
  }

  return {
    timezone: schedule.timezone,
    times,
    matchesDate,
    until: rule.until,
    notBefore: anchorDate,
    horizonDays,
  };
}

export function compileSchedule(schedule: ResetSchedule): CompiledSchedule {
  const key = cacheKey(schedule);
  const cached = compiledCache.get(key);
  if (cached) return cached;

  const time = [{ hour: schedule.hour, minute: schedule.minute }];
  let compiled: CompiledSchedule;
  switch (schedule.frequency) {
    case 'DAILY':
      compiled = {
        timezone: schedule.timezone,
        times: time,
        matchesDate: () => true,
        until: null,
        notBefore: null,
        horizonDays: 2,
      };
      break;
    case 'WEEKLY': {
      const weekday = schedule.dayOfWeek;
      if (weekday === null) throw new RRuleError('WEEKLY reset requires dayOfWeek');
      compiled = {
        timezone: schedule.timezone,
        times: time,
        matchesDate: (date) => isoWeekday(date) === weekday,
        until: null,
        notBefore: null,
        horizonDays: 8,
      };
      break;
    }
    case 'MONTHLY': {
      const day = schedule.dayOfMonth;
      if (day === null) throw new RRuleError('MONTHLY reset requires dayOfMonth');
      compiled = {
        timezone: schedule.timezone,
        times: time,
        matchesDate: (date) => monthDayMatches(date, day),
        until: null,
        notBefore: null,
        horizonDays: 125,
      };
      break;
    }
    case 'CUSTOM_RRULE': {
      if (schedule.rrule === null) throw new RRuleError('CUSTOM_RRULE reset requires rrule');
      compiled = compileRRule(schedule, parseRRule(schedule.rrule));
      break;
    }
  }
  compiledCache.set(key, compiled);
  return compiled;
}

/** First occurrence strictly after `after`, or null if the rule has ended. */
export function nextOccurrence(schedule: ResetSchedule, after: Date): Date | null {
  const compiled = compileSchedule(schedule);
  const afterMs = after.getTime();
  let startDate = addDays(toCalendarDate(after, compiled.timezone), -1);
  if (compiled.notBefore !== null && calendarDayDiff(startDate, compiled.notBefore) > 0) {
    startDate = compiled.notBefore;
  }
  for (let offset = 0; offset <= compiled.horizonDays + 1; offset += 1) {
    const date = addDays(startDate, offset);
    if (!compiled.matchesDate(date)) continue;
    for (const time of compiled.times) {
      const instant = zonedTimeToUtc({ ...date, hour: time.hour, minute: time.minute }, compiled.timezone);
      if (instant.getTime() <= afterMs) continue;
      if (compiled.until !== null && instant.getTime() > compiled.until.getTime()) return null;
      return instant;
    }
  }
  return null;
}

/** Last occurrence at or before `before`, or null if none within the scan horizon. */
export function previousOccurrence(schedule: ResetSchedule, before: Date): Date | null {
  const compiled = compileSchedule(schedule);
  const beforeMs = before.getTime();
  const startDate = addDays(toCalendarDate(before, compiled.timezone), 1);
  for (let offset = 0; offset <= compiled.horizonDays + 1; offset += 1) {
    const date = addDays(startDate, -offset);
    if (!compiled.matchesDate(date)) continue;
    for (const time of [...compiled.times].reverse()) {
      const instant = zonedTimeToUtc({ ...date, hour: time.hour, minute: time.minute }, compiled.timezone);
      if (instant.getTime() > beforeMs) continue;
      if (compiled.until !== null && instant.getTime() > compiled.until.getTime()) continue;
      return instant;
    }
  }
  return null;
}

/** Occurrences in [from, to), capped at `limit`. */
export function occurrencesBetween(
  schedule: ResetSchedule,
  from: Date,
  to: Date,
  limit = 500,
): Date[] {
  const result: Date[] = [];
  let cursor = new Date(from.getTime() - 1);
  while (result.length < limit) {
    const next = nextOccurrence(schedule, cursor);
    if (next === null || next.getTime() >= to.getTime()) break;
    result.push(next);
    cursor = next;
  }
  return result;
}

/** Returns a list of problems with a schedule; empty when it compiles and produces occurrences. */
export function validateSchedule(schedule: ResetSchedule, reference: Date = new Date()): string[] {
  try {
    compileSchedule(schedule);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  return nextOccurrence(schedule, reference) === null ? ['Rule produces no future occurrence'] : [];
}
