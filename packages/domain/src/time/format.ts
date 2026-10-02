/**
 * Display formatting for dates, countdowns and D-day labels.
 * All functions are pure and take the time zone and locale explicitly.
 */
import { DAY_MS, HOUR_MS, MINUTE_MS } from '../constants';
import { calendarDayDiff, getWallTime, parseFixedOffset, toCalendarDate } from './zone';

const WEEKDAYS: Readonly<Record<string, readonly string[]>> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
};

function language(locale: string): string {
  return locale.slice(0, 2).toLowerCase();
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function weekdayLabel(date: { year: number; month: number; day: number }, locale: string): string {
  const jsDay = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  const table = WEEKDAYS[language(locale)] ?? WEEKDAYS.en ?? [];
  return table[jsDay] ?? '';
}

/** "10.08 (수) 06:00" — the dense, scoreboard-style format used across the UI. */
export function formatCompactDateTime(
  value: Date | string,
  timeZone: string,
  locale: string,
  options: { weekday?: boolean; year?: boolean } = {},
): string {
  const wall = getWallTime(toDate(value), timeZone);
  const datePart = `${options.year ? `${wall.year}.` : ''}${pad2(wall.month)}.${pad2(wall.day)}`;
  const weekday = options.weekday === false ? '' : ` (${weekdayLabel(wall, locale)})`;
  return `${datePart}${weekday} ${pad2(wall.hour)}:${pad2(wall.minute)}`;
}

/** "2026.10.08" */
export function formatCompactDate(value: Date | string, timeZone: string): string {
  const wall = getWallTime(toDate(value), timeZone);
  return `${wall.year}.${pad2(wall.month)}.${pad2(wall.day)}`;
}

/** "06:00" */
export function formatClockTime(value: Date | string, timeZone: string): string {
  const wall = getWallTime(toDate(value), timeZone);
  return `${pad2(wall.hour)}:${pad2(wall.minute)}`;
}

/** Long, human-readable date-time in the user's locale, e.g. "2026년 10월 8일 (수) 오전 6:00". */
export function formatLongDateTime(value: Date | string, timeZone: string, locale: string): string {
  const intlZone = toIntlTimeZone(timeZone);
  return new Intl.DateTimeFormat(locale, {
    timeZone: intlZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(toDate(value));
}

/**
 * Intl only understands IANA names (and, in newer engines, "+08:00" offsets).
 * Fixed offsets with whole hours map onto the equivalent Etc/GMT zone (sign inverted by POSIX).
 */
export function toIntlTimeZone(timeZone: string): string {
  const fixed = parseFixedOffset(timeZone);
  if (fixed === null) return timeZone;
  if (fixed === 0) return 'UTC';
  if (fixed % 60 === 0) {
    const hours = fixed / 60;
    return `Etc/GMT${hours > 0 ? '-' : '+'}${Math.abs(hours)}`;
  }
  return 'UTC';
}

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function splitDuration(ms: number): DurationParts {
  const clamped = Math.max(0, Math.floor(ms / 1000) * 1000);
  return {
    days: Math.floor(clamped / DAY_MS),
    hours: Math.floor((clamped % DAY_MS) / HOUR_MS),
    minutes: Math.floor((clamped % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((clamped % MINUTE_MS) / 1000),
  };
}

/** "03:42:18" for durations under a day; "27:05:00" style is avoided — callers switch to D-day. */
export function formatClockDuration(ms: number): string {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  return `${pad2(days * 24 + hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

/**
 * D-day label relative to the user's calendar: "D-DAY" (today), "D-3" (in three days),
 * "D+2" (two days ago).
 */
export function formatDDay(target: Date | string, now: Date, timeZone: string): string {
  const diff = calendarDayDiff(toCalendarDate(now, timeZone), toCalendarDate(toDate(target), timeZone));
  if (diff === 0) return 'D-DAY';
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
}

/**
 * The dashboard's remaining-time label: a live clock under 24 hours, a D-day label beyond.
 * Returns null when the target has passed.
 */
export function formatRemaining(target: Date | string, now: Date, timeZone: string): string | null {
  const remaining = toDate(target).getTime() - now.getTime();
  if (remaining <= 0) return null;
  if (remaining < DAY_MS) return formatClockDuration(remaining);
  return formatDDay(target, now, timeZone);
}

/** Short relative phrase for past timestamps: "방금", "5분 전", "3시간 전", "2일 전". */
export function formatRelativePast(value: Date | string, now: Date, locale: string): string {
  const elapsed = Math.max(0, now.getTime() - toDate(value).getTime());
  const lang = language(locale);
  const minutes = Math.floor(elapsed / MINUTE_MS);
  const hours = Math.floor(elapsed / HOUR_MS);
  const days = Math.floor(elapsed / DAY_MS);
  if (lang === 'ko') {
    if (minutes < 1) return '방금';
    if (hours < 1) return `${minutes}분 전`;
    if (days < 1) return `${hours}시간 전`;
    return `${days}일 전`;
  }
  if (minutes < 1) return 'just now';
  if (hours < 1) return `${minutes}m ago`;
  if (days < 1) return `${hours}h ago`;
  return `${days}d ago`;
}
