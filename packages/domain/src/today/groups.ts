/**
 * Current / upcoming / recent grouping for game pages (overview, events, rewards).
 * Generic over content types: ranged items use their window, point-in-time items (patches,
 * announcements) their release or publication moment, maintenance its maintenance state.
 */
import { DAY_MS } from '../constants';
import type { PulseItem } from '../content';
import { effectiveTimeMs, isPointInTime } from '../query';
import { computeMaintenanceState, computeStatusForType } from '../status/status';
import { toEpochMs } from '../time/zone';

export const TIMELINE_GROUPS = ['current', 'upcoming', 'recent'] as const;
export type TimelineGroup = (typeof TIMELINE_GROUPS)[number];

export type TimelineGroups<T> = Record<TimelineGroup, T[]>;

export interface TimelineGroupOptions {
  /** Upcoming items starting later than this are left out. */
  upcomingWindowMs: number;
  /** Items that ended (or were released) longer ago than this are left out. */
  recentWindowMs: number;
  recentLimit: number;
}

export const DEFAULT_TIMELINE_GROUP_OPTIONS: TimelineGroupOptions = {
  upcomingWindowMs: 60 * DAY_MS,
  recentWindowMs: 30 * DAY_MS,
  recentLimit: 10,
};

type Groupable = Pick<
  PulseItem,
  'id' | 'type' | 'startAt' | 'endAt' | 'sourcePublishedAt' | 'publishedAt'
>;

export function timelineGroupOf(item: Groupable, nowMs: number): TimelineGroup | null {
  if (item.type === 'MAINTENANCE') {
    switch (computeMaintenanceState(item, nowMs)) {
      case 'SCHEDULED':
        return 'upcoming';
      case 'IN_PROGRESS':
        return 'current';
      case 'COMPLETED':
        return 'recent';
      case 'UNKNOWN': {
        // Open-ended maintenance past the plausibility limit: history, not "now".
        const start = toEpochMs(item.startAt);
        return start !== null && start <= nowMs ? 'recent' : null;
      }
    }
  }
  if (isPointInTime(item)) return effectiveTimeMs(item) > nowMs ? 'upcoming' : 'recent';
  switch (computeStatusForType(item.type, item, nowMs)) {
    case 'UPCOMING':
      return 'upcoming';
    case 'LIVE':
    case 'ENDING_SOON':
      return 'current';
    case 'ENDED':
      return 'recent';
    case 'UNKNOWN':
      return null;
  }
}

/** The moment an item stopped being current (end, or release/publication). */
function closedAtMs(item: Groupable): number {
  return toEpochMs(item.endAt) ?? effectiveTimeMs(item);
}

function compareIds(a: Groupable, b: Groupable): number {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * current: soonest-ending first (open-ended last); upcoming: soonest-starting first;
 * recent: most recently closed first, limited.
 */
export function groupByTimeline<T extends Groupable>(
  items: readonly T[],
  now: Date | number,
  options: Partial<TimelineGroupOptions> = {},
): TimelineGroups<T> {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const { upcomingWindowMs, recentWindowMs, recentLimit } = {
    ...DEFAULT_TIMELINE_GROUP_OPTIONS,
    ...options,
  };
  const groups: TimelineGroups<T> = { current: [], upcoming: [], recent: [] };
  for (const item of items) {
    const group = timelineGroupOf(item, nowMs);
    if (group === 'upcoming' && effectiveTimeMs(item) - nowMs > upcomingWindowMs) continue;
    if (group === 'recent' && nowMs - closedAtMs(item) > recentWindowMs) continue;
    if (group) groups[group].push(item);
  }
  const endOrInfinity = (item: T) => toEpochMs(item.endAt) ?? Number.POSITIVE_INFINITY;
  groups.current.sort((a, b) => endOrInfinity(a) - endOrInfinity(b) || compareIds(a, b));
  groups.upcoming.sort((a, b) => effectiveTimeMs(a) - effectiveTimeMs(b) || compareIds(a, b));
  groups.recent.sort((a, b) => closedAtMs(b) - closedAtMs(a) || compareIds(a, b));
  groups.recent = groups.recent.slice(0, recentLimit);
  return groups;
}
