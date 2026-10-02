/**
 * Deterministic parser for the date-range formats official notices use, e.g.
 *   "2026/09/30 10:00 ~ 2026/11/03 03:59 (UTC+8)"
 *   "2026년 7월 30일 11:00 ~ 2026년 8월 19일 12:59 (한국 시간)"
 *   "점검 시간: 2026년 9월 30일 05:00 ~ 12:00"
 *
 * Zone labels are mapped explicitly ("(UTC+8)", "(서버 시간)", "(server time)", "(한국 시간)").
 * When no label is present the source's declared default zone is used; when neither exists the
 * time is not normalized (never guessed).
 */
import { isValidTimeZone, zonedTimeToUtc } from '@gamepulse/domain';
import { emptyExtractionItem, type AiExtraction, type AiExtractionItem } from './schema';
import type { AIParser, ParserInput, ParserOutput } from './types';

const DATE = String.raw`(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?\s*(?:\([^)]{1,3}\)\s*)?`;
const TIME = String.raw`(\d{1,2}):(\d{2})`;
const LABEL = String.raw`(?:\s*\(([^)]{1,24})\))?`;
const SEPARATOR = String.raw`\s*[~～\-–—]\s*`;

const FULL_RANGE = new RegExp(`${DATE}${TIME}${LABEL}${SEPARATOR}${DATE}${TIME}${LABEL}`);
const SAME_DAY_RANGE = new RegExp(`${DATE}${TIME}${SEPARATOR}${TIME}${LABEL}`);

interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function wall(parts: Array<string | undefined>): Wall | null {
  const numbers = parts.map((part) => (part === undefined ? Number.NaN : Number(part)));
  if (numbers.length !== 5 || numbers.some((value) => Number.isNaN(value))) return null;
  const [year, month, day, hour, minute] = numbers as [number, number, number, number, number];
  const valid = month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour <= 23 && minute <= 59;
  return valid ? { year, month, day, hour, minute } : null;
}

/** Maps a zone label from official text to a time-zone identifier, or null if unknown. */
export function resolveZoneLabel(
  label: string | undefined,
  input: Pick<ParserInput, 'defaultTimezone' | 'serverTimezone'>,
): string | null {
  if (label === undefined) return input.defaultTimezone;
  const normalized = label.trim();
  const lower = normalized.toLowerCase();
  const offset = /^(?:utc|gmt)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i.exec(normalized);
  if (offset) return `UTC${offset[1]}${offset[2]}${offset[3] ? `:${offset[3]}` : ''}`;
  if (lower.includes('서버') || lower.includes('server')) return input.serverTimezone;
  if (lower.includes('한국') || lower === 'kst') return 'Asia/Seoul';
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const describe = (w: Wall) =>
  `${w.year}/${pad(w.month)}/${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}`;

function kindFor(task: ParserInput['task']): AiExtractionItem['kind'] {
  switch (task) {
    case 'MAINTENANCE':
      return 'MAINTENANCE';
    case 'REWARD':
      return 'REWARD';
    case 'PATCH':
      return 'UPDATE';
    case 'EVENT':
    case 'CLASSIFY':
      return 'EVENT';
  }
}

export function extractDateRange(input: ParserInput): AiExtractionItem | null {
  const full = FULL_RANGE.exec(input.text);
  let start: Wall | null = null;
  let end: Wall | null = null;
  let label: string | undefined;
  let excerpt = '';

  if (full) {
    start = wall(full.slice(1, 6));
    end = wall(full.slice(7, 12));
    label = full[12] ?? full[6];
    excerpt = full[0];
  } else {
    const sameDay = SAME_DAY_RANGE.exec(input.text);
    if (!sameDay) return null;
    start = wall(sameDay.slice(1, 6));
    end = wall([sameDay[1], sameDay[2], sameDay[3], sameDay[6], sameDay[7]]);
    label = sameDay[8];
    excerpt = sameDay[0];
  }
  if (start === null || end === null) return null;

  const zone = resolveZoneLabel(label, input);
  const item = emptyExtractionItem(kindFor(input.task), input.title ?? excerpt);
  item.startAtSource = `${describe(start)}${label ? ` (${label})` : ''}`;
  item.endAtSource = `${describe(end)}${label ? ` (${label})` : ''}`;
  item.datePrecision = 'DATETIME';
  item.evidence = [
    { field: 'startAt', excerpt: excerpt.trim() },
    { field: 'endAt', excerpt: excerpt.trim() },
  ];
  if (zone === null || !isValidTimeZone(zone)) {
    // Cannot normalize without a known zone: keep the original text, leave instants unknown.
    item.confidence = 0.3;
    return item;
  }
  item.sourceTimezone = zone;
  item.startAt = zonedTimeToUtc(start, zone).toISOString();
  item.endAt = zonedTimeToUtc(end, zone).toISOString();
  item.confidence = 0.9;
  return item;
}

export class RuleBasedParser implements AIParser {
  readonly id = 'rule-based';
  readonly version = 'rule-based-1';
  readonly kind = 'deterministic' as const;

  parse(input: ParserInput): Promise<ParserOutput> {
    const item = input.task === 'PATCH' ? null : extractDateRange(input);
    const extraction: AiExtraction = { items: item ? [item] : [] };
    return Promise.resolve({ extraction, model: null, usage: null });
  }
}
