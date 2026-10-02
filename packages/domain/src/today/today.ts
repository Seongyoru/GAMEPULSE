/**
 * TODAY model: answers "what changed, what can I claim, what resets/expires" for a set of
 * games at a given instant. Pure and deterministic — runs on the server for the initial
 * render and on the client for live updates and MY GAMES filtering.
 */
import { DAY_MS, HOUR_MS } from '../constants';
import type { PulseItem } from '../content';
import type { TimeStatus } from '../enums';
import { nextOccurrence } from '../reset/engine';
import type { ResetRuleDefinition } from '../schemas/reset';
import {
  computeMaintenanceState,
  computeStatusForType,
  NEW_CONTENT_WINDOW_MS,
} from '../status/status';
import { toEpochMs } from '../time/zone';
import {
  compareUrgency,
  computeItemUrgency,
  computeResetUrgency,
  effectiveStartMs,
  type Urgency,
} from '../urgency/urgency';

export const TODAY_SECTIONS = [
  'critical',
  'rewards',
  'resets',
  'endingSoon',
  'newEvents',
  'maintenance',
  'upcoming',
] as const;
export type TodaySectionId = (typeof TODAY_SECTIONS)[number];

export interface TodayItemEntry {
  kind: 'item';
  item: PulseItem;
  status: TimeStatus;
  urgency: Urgency;
}

export interface TodayResetEntry {
  kind: 'reset';
  rule: ResetRuleDefinition;
  nextAt: string;
  urgency: Urgency;
}

export type TodayEntry = TodayItemEntry | TodayResetEntry;

export interface TodaySummary {
  total: number;
  /** Critical changes: new patches/updates, live maintenance, key announcements. */
  updates: number;
  rewards: number;
  /** Resets within the next 24 hours. */
  resets: number;
  endingSoon: number;
}

export interface TodayModel {
  now: string;
  gameIds: string[];
  summary: TodaySummary;
  sections: Record<TodaySectionId, TodayEntry[]>;
}

export interface TodayOptions {
  upcomingWindowMs: number;
  resetWindowMs: number;
  upcomingPatchCriticalMs: number;
  announcementPriorityThreshold: number;
  announcementWindowMs: number;
  dismissedIds: readonly string[];
}

export const DEFAULT_TODAY_OPTIONS: TodayOptions = {
  upcomingWindowMs: 7 * DAY_MS,
  resetWindowMs: 7 * DAY_MS,
  upcomingPatchCriticalMs: DAY_MS,
  announcementPriorityThreshold: 80,
  announcementWindowMs: 48 * HOUR_MS,
  dismissedIds: [],
};

/** Decides which TODAY section an item belongs to (each item appears at most once). */
export function classifyTodayItem(
  item: PulseItem,
  nowMs: number,
  options: TodayOptions = DEFAULT_TODAY_OPTIONS,
): TodaySectionId | null {
  const start = toEpochMs(item.startAt);
  const startsWithin = (windowMs: number) => start !== null && start > nowMs && start - nowMs <= windowMs;

  switch (item.type) {
    case 'MAINTENANCE': {
      const state = computeMaintenanceState(item, nowMs);
      if (state === 'IN_PROGRESS') return 'critical';
      if (state === 'SCHEDULED' && startsWithin(options.upcomingWindowMs)) return 'maintenance';
      return null;
    }
    case 'PATCH':
    case 'UPDATE': {
      const released = effectiveStartMs(item);
      if (released !== null && released <= nowMs && nowMs - released <= NEW_CONTENT_WINDOW_MS) {
        return 'critical';
      }
      if (startsWithin(options.upcomingPatchCriticalMs)) return 'critical';
      if (startsWithin(options.upcomingWindowMs)) return 'upcoming';
      return null;
    }
    case 'REWARD':
    case 'REDEEM_CODE': {
      const status = computeStatusForType(item.type, item, nowMs);
      if (status === 'LIVE' || status === 'ENDING_SOON') return 'rewards';
      if (status === 'UNKNOWN') {
        const published = effectiveStartMs(item);
        return published !== null && nowMs - published <= options.upcomingWindowMs ? 'rewards' : null;
      }
      if (status === 'UPCOMING' && startsWithin(options.upcomingWindowMs)) return 'upcoming';
      return null;
    }
    case 'EVENT':
    case 'BANNER': {
      const status = computeStatusForType(item.type, item, nowMs);
      if (status === 'ENDING_SOON') return 'endingSoon';
      if (status === 'LIVE' && start !== null && nowMs - start <= NEW_CONTENT_WINDOW_MS) return 'newEvents';
      if (status === 'UPCOMING' && startsWithin(options.upcomingWindowMs)) return 'upcoming';
      return null;
    }
    case 'ANNOUNCEMENT': {
      const published = effectiveStartMs(item);
      const recent = published !== null && nowMs - published <= options.announcementWindowMs;
      return recent && item.priority >= options.announcementPriorityThreshold ? 'critical' : null;
    }
  }
}

function emptySections(): Record<TodaySectionId, TodayEntry[]> {
  return {
    critical: [],
    rewards: [],
    resets: [],
    endingSoon: [],
    newEvents: [],
    maintenance: [],
    upcoming: [],
  };
}

export function buildToday(input: {
  items: readonly PulseItem[];
  resets: readonly ResetRuleDefinition[];
  now: Date;
  gameIds: readonly string[];
  options?: Partial<TodayOptions>;
}): TodayModel {
  const options: TodayOptions = { ...DEFAULT_TODAY_OPTIONS, ...input.options };
  const nowMs = input.now.getTime();
  const games = new Set(input.gameIds);
  const dismissed = new Set(options.dismissedIds);
  const sections = emptySections();

  for (const item of input.items) {
    if (!games.has(item.gameId) || dismissed.has(item.id)) continue;
    const section = classifyTodayItem(item, nowMs, options);
    if (section === null) continue;
    sections[section].push({
      kind: 'item',
      item,
      status: computeStatusForType(item.type, item, nowMs),
      urgency: computeItemUrgency(item, nowMs),
    });
  }

  for (const rule of input.resets) {
    if (!games.has(rule.gameId)) continue;
    const next = nextOccurrence(rule, input.now);
    if (next === null || next.getTime() - nowMs > options.resetWindowMs) continue;
    sections.resets.push({
      kind: 'reset',
      rule,
      nextAt: next.toISOString(),
      urgency: computeResetUrgency(next, nowMs),
    });
  }

  const sortKey = (entry: TodayEntry) =>
    entry.kind === 'item'
      ? { urgency: entry.urgency, priority: entry.item.priority, title: entry.item.title }
      : { urgency: entry.urgency, priority: entry.rule.isPrimary ? 60 : 50, title: entry.rule.name };
  for (const id of Object.keys(sections) as TodaySectionId[]) {
    sections[id].sort((a, b) => compareUrgency(sortKey(a), sortKey(b)));
  }

  const resetsWithinDay = sections.resets.filter((entry) => entry.urgency.reason === 'RESET_24H').length;
  const summary: TodaySummary = {
    updates: sections.critical.length,
    rewards: sections.rewards.length,
    resets: resetsWithinDay,
    endingSoon: sections.endingSoon.length,
    total: 0,
  };
  summary.total = summary.updates + summary.rewards + summary.resets + summary.endingSoon;

  return { now: input.now.toISOString(), gameIds: [...input.gameIds], summary, sections };
}
