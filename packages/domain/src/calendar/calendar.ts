/**
 * Unified multi-game calendar: start/end markers for time-bounded content plus reset
 * occurrences, bucketed by the viewer's local calendar day.
 */
import type { PulseItem } from '../content';
import type { ContentType } from '../enums';
import { occurrencesBetween } from '../reset/engine';
import type { ResetRuleDefinition } from '../schemas/reset';
import {
  addDays,
  calendarDayDiff,
  daysInMonth,
  formatCalendarDate,
  isoWeekday,
  startOfDay,
  toCalendarDate,
  toEpochMs,
  type CalendarDate,
} from '../time/zone';

export const CALENDAR_MARKERS = ['START', 'END', 'RELEASE', 'RESET'] as const;
export type CalendarMarker = (typeof CALENDAR_MARKERS)[number];

export interface CalendarEntry {
  id: string;
  gameId: string;
  marker: CalendarMarker;
  /** Content type, or null for resets. */
  type: ContentType | null;
  title: string;
  at: string;
  href: string | null;
  /** Attribution the entry's source requires (null for resets and most sources). */
  sourceAttribution: string | null;
}

export interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  entries: CalendarEntry[];
}

export interface CalendarMonth {
  year: number;
  month: number;
  weeks: CalendarDay[][];
}

const RANGE_TYPES: readonly ContentType[] = [
  'EVENT',
  'BANNER',
  'REWARD',
  'REDEEM_CODE',
  'MAINTENANCE',
];

/** Calendar entries for every item/reset in [from, to). */
export function collectCalendarEntries(input: {
  items: readonly PulseItem[];
  resets: readonly ResetRuleDefinition[];
  from: Date;
  to: Date;
  gameIds?: readonly string[];
}): CalendarEntry[] {
  const games = input.gameIds ? new Set(input.gameIds) : null;
  const fromMs = input.from.getTime();
  const toMs = input.to.getTime();
  const inRange = (ms: number | null): ms is number => ms !== null && ms >= fromMs && ms < toMs;
  const entries: CalendarEntry[] = [];

  for (const item of input.items) {
    if (games && !games.has(item.gameId)) continue;
    const start = toEpochMs(item.startAt);
    const end = toEpochMs(item.endAt);
    const push = (marker: CalendarMarker, at: number) =>
      entries.push({
        id: `${item.id}:${marker}`,
        gameId: item.gameId,
        marker,
        type: item.type,
        title: item.title,
        at: new Date(at).toISOString(),
        href: item.href,
        sourceAttribution: item.sourceAttribution,
      });

    if (item.type === 'PATCH' || item.type === 'UPDATE') {
      const release = start ?? toEpochMs(item.sourcePublishedAt);
      if (inRange(release)) push('RELEASE', release);
    } else if (RANGE_TYPES.includes(item.type)) {
      if (inRange(start)) push('START', start);
      if (inRange(end)) push('END', end);
    }
  }

  for (const rule of input.resets) {
    if (games && !games.has(rule.gameId)) continue;
    if (rule.frequency === 'DAILY') continue;
    for (const occurrence of occurrencesBetween(rule, input.from, input.to, 62)) {
      entries.push({
        id: `${rule.id}:${occurrence.toISOString()}`,
        gameId: rule.gameId,
        marker: 'RESET',
        type: null,
        title: rule.name,
        at: occurrence.toISOString(),
        href: null,
        sourceAttribution: null,
      });
    }
  }

  return entries.sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at) || a.title.localeCompare(b.title),
  );
}

/**
 * Month grid (weeks × 7 days) in the viewer's time zone.
 * @param weekStartsOn ISO weekday the grid starts on (7 = Sunday, the Korean convention).
 */
export function buildCalendarMonth(input: {
  year: number;
  month: number;
  timeZone: string;
  now: Date;
  items: readonly PulseItem[];
  resets: readonly ResetRuleDefinition[];
  gameIds?: readonly string[];
  weekStartsOn?: number;
}): CalendarMonth {
  const weekStartsOn = input.weekStartsOn ?? 7;
  const first: CalendarDate = { year: input.year, month: input.month, day: 1 };
  const leading = (isoWeekday(first) - weekStartsOn + 7) % 7;
  const gridStart = addDays(first, -leading);
  const totalDays = Math.ceil((leading + daysInMonth(input.year, input.month)) / 7) * 7;
  const gridEnd = addDays(gridStart, totalDays);

  const entries = collectCalendarEntries({
    items: input.items,
    resets: input.resets,
    from: startOfDay(gridStart, input.timeZone),
    to: startOfDay(gridEnd, input.timeZone),
    ...(input.gameIds ? { gameIds: input.gameIds } : {}),
  });

  const byDate = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const key = formatCalendarDate(toCalendarDate(new Date(entry.at), input.timeZone));
    const bucket = byDate.get(key);
    if (bucket) bucket.push(entry);
    else byDate.set(key, [entry]);
  }

  const today = toCalendarDate(input.now, input.timeZone);
  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < totalDays; index += 1) {
    const date = addDays(gridStart, index);
    const key = formatCalendarDate(date);
    const day: CalendarDay = {
      date: key,
      day: date.day,
      inMonth: date.month === input.month,
      isToday: calendarDayDiff(today, date) === 0,
      entries: byDate.get(key) ?? [],
    };
    if (index % 7 === 0) weeks.push([day]);
    else weeks[weeks.length - 1]?.push(day);
  }

  return { year: input.year, month: input.month, weeks };
}
