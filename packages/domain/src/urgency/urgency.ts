/**
 * Urgency ranking for TODAY. Lower tier = more urgent. Order follows the product spec:
 *
 *   1 maintenance in progress
 *   2 expires < 6h
 *   3 claimable reward
 *   4 expires < 24h
 *   5 reset < 24h
 *   6 new patch
 *   7 new event
 *   8 upcoming
 *   9 ongoing (no special urgency)
 *  10 nothing actionable / ended
 */
import { DAY_MS, HOUR_MS } from '../constants';
import type { ContentType } from '../enums';
import {
  computeMaintenanceState,
  computeStatusForType,
  NEW_CONTENT_WINDOW_MS,
} from '../status/status';
import { toEpochMs } from '../time/zone';

export const URGENCY_REASONS = [
  'MAINTENANCE_LIVE',
  'EXPIRES_6H',
  'CLAIMABLE_REWARD',
  'EXPIRES_24H',
  'RESET_24H',
  'NEW_PATCH',
  'NEW_EVENT',
  'UPCOMING',
  'ONGOING',
  'NONE',
] as const;
export type UrgencyReason = (typeof URGENCY_REASONS)[number];

export const URGENCY_TIER: Readonly<Record<UrgencyReason, number>> = {
  MAINTENANCE_LIVE: 1,
  EXPIRES_6H: 2,
  CLAIMABLE_REWARD: 3,
  EXPIRES_24H: 4,
  RESET_24H: 5,
  NEW_PATCH: 6,
  NEW_EVENT: 7,
  UPCOMING: 8,
  ONGOING: 9,
  NONE: 10,
};

export interface Urgency {
  tier: number;
  reason: UrgencyReason;
  /** The instant that drives the urgency (deadline, start, reset), epoch ms. */
  at: number | null;
}

export interface UrgencyInput {
  type: ContentType;
  startAt: string | null;
  endAt: string | null;
  publishedAt: string;
  sourcePublishedAt: string | null;
  priority: number;
}

const REWARD_TYPES: readonly ContentType[] = ['REWARD', 'REDEEM_CODE'];
const PATCH_TYPES: readonly ContentType[] = ['PATCH', 'UPDATE'];
const EVENT_TYPES: readonly ContentType[] = ['EVENT', 'BANNER'];

function urgency(reason: UrgencyReason, at: number | null): Urgency {
  return { tier: URGENCY_TIER[reason], reason, at };
}

/** When an item became (or becomes) relevant: release/start, else official publication. */
export function effectiveStartMs(
  item: Pick<UrgencyInput, 'startAt' | 'sourcePublishedAt' | 'publishedAt'>,
): number | null {
  return (
    toEpochMs(item.startAt) ?? toEpochMs(item.sourcePublishedAt) ?? toEpochMs(item.publishedAt)
  );
}

export function computeItemUrgency(item: UrgencyInput, now: Date | number): Urgency {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const end = toEpochMs(item.endAt);
  const start = toEpochMs(item.startAt);

  if (item.type === 'MAINTENANCE') {
    const state = computeMaintenanceState(item, nowMs);
    if (state === 'IN_PROGRESS') return urgency('MAINTENANCE_LIVE', end);
    if (state === 'SCHEDULED') return urgency('UPCOMING', start);
    return urgency('NONE', null);
  }

  const status = computeStatusForType(item.type, item, nowMs);
  if (status === 'ENDED') return urgency('NONE', end);
  const active = status === 'LIVE' || status === 'ENDING_SOON' || status === 'UNKNOWN';

  if (active && end !== null && end - nowMs <= 6 * HOUR_MS) return urgency('EXPIRES_6H', end);
  if (REWARD_TYPES.includes(item.type) && (status === 'LIVE' || status === 'ENDING_SOON')) {
    return urgency('CLAIMABLE_REWARD', end);
  }
  if (active && end !== null && end - nowMs <= DAY_MS) return urgency('EXPIRES_24H', end);

  if (PATCH_TYPES.includes(item.type)) {
    const released = effectiveStartMs(item);
    if (released !== null && released <= nowMs && nowMs - released <= NEW_CONTENT_WINDOW_MS) {
      return urgency('NEW_PATCH', released);
    }
  }
  if (EVENT_TYPES.includes(item.type) && status === 'LIVE' && start !== null) {
    if (nowMs - start <= NEW_CONTENT_WINDOW_MS) return urgency('NEW_EVENT', start);
  }
  if (status === 'UPCOMING') return urgency('UPCOMING', start);
  if (active) return urgency('ONGOING', end);
  return urgency('NONE', null);
}

export function computeResetUrgency(nextAt: Date | number, now: Date | number): Urgency {
  const nextMs = typeof nextAt === 'number' ? nextAt : nextAt.getTime();
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return nextMs - nowMs <= DAY_MS ? urgency('RESET_24H', nextMs) : urgency('UPCOMING', nextMs);
}

/** Sort comparator: tier, then the driving instant (soonest first), then priority. */
export function compareUrgency(
  a: { urgency: Urgency; priority?: number; title?: string },
  b: { urgency: Urgency; priority?: number; title?: string },
): number {
  if (a.urgency.tier !== b.urgency.tier) return a.urgency.tier - b.urgency.tier;
  const aAt = a.urgency.at ?? Number.POSITIVE_INFINITY;
  const bAt = b.urgency.at ?? Number.POSITIVE_INFINITY;
  if (aAt !== bAt) return aAt - bAt;
  const priorityDiff = (b.priority ?? 50) - (a.priority ?? 50);
  if (priorityDiff !== 0) return priorityDiff;
  return (a.title ?? '').localeCompare(b.title ?? '');
}
