/**
 * Status engine. Time-based statuses are always computed from startAt/endAt and "now";
 * they are never stored or updated by a cron job.
 */
import { DAY_MS, HOUR_MS } from '../constants';
import type { ContentType, MaintenanceState, RewardState, TimeStatus } from '../enums';
import { toEpochMs } from '../time/zone';

export interface TimeWindow {
  startAt: string | Date | null;
  endAt: string | Date | null;
}

export interface StatusThresholds {
  /** An item whose end is closer than this is ENDING_SOON. 0 disables ENDING_SOON. */
  endingSoonMs: number;
}

export const DEFAULT_ENDING_SOON_MS = 48 * HOUR_MS;

/** Per-type overrides of the default thresholds. */
export const STATUS_THRESHOLDS_BY_TYPE: Readonly<Partial<Record<ContentType, StatusThresholds>>> = {
  MAINTENANCE: { endingSoonMs: 0 },
};

/** Maintenance with no announced end is no longer reported IN_PROGRESS after this long. */
export const OPEN_MAINTENANCE_MAX_MS = 12 * HOUR_MS;

/** "New" window for patches, events and announcements. */
export const NEW_CONTENT_WINDOW_MS = 3 * DAY_MS;

export function thresholdsFor(type?: ContentType): StatusThresholds {
  return (type && STATUS_THRESHOLDS_BY_TYPE[type]) ?? { endingSoonMs: DEFAULT_ENDING_SOON_MS };
}

export function computeTimeStatus(
  window: TimeWindow,
  now: Date | number,
  thresholds: StatusThresholds = thresholdsFor(),
): TimeStatus {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const start = toEpochMs(window.startAt);
  const end = toEpochMs(window.endAt);
  if (start === null && end === null) return 'UNKNOWN';
  if (start !== null && nowMs < start) return 'UPCOMING';
  if (end !== null && nowMs >= end) return 'ENDED';
  if (end !== null && thresholds.endingSoonMs > 0 && end - nowMs <= thresholds.endingSoonMs) {
    return 'ENDING_SOON';
  }
  return 'LIVE';
}

export function computeStatusForType(
  type: ContentType,
  window: TimeWindow,
  now: Date | number,
): TimeStatus {
  return computeTimeStatus(window, now, thresholdsFor(type));
}

export function rewardStateFromStatus(status: TimeStatus): RewardState {
  switch (status) {
    case 'UPCOMING':
      return 'UPCOMING';
    case 'LIVE':
      return 'AVAILABLE';
    case 'ENDING_SOON':
      return 'ENDING_SOON';
    case 'ENDED':
      return 'EXPIRED';
    case 'UNKNOWN':
      return 'UNKNOWN';
  }
}

export function computeRewardState(window: TimeWindow, now: Date | number): RewardState {
  return rewardStateFromStatus(computeTimeStatus(window, now));
}

export function computeMaintenanceState(window: TimeWindow, now: Date | number): MaintenanceState {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const status = computeTimeStatus(window, nowMs, thresholdsFor('MAINTENANCE'));
  switch (status) {
    case 'UPCOMING':
      return 'SCHEDULED';
    case 'ENDED':
      return 'COMPLETED';
    case 'UNKNOWN':
      return 'UNKNOWN';
    case 'LIVE':
    case 'ENDING_SOON': {
      const start = toEpochMs(window.startAt);
      const end = toEpochMs(window.endAt);
      if (end === null && start !== null && nowMs - start > OPEN_MAINTENANCE_MAX_MS)
        return 'UNKNOWN';
      return 'IN_PROGRESS';
    }
  }
}

/** True when a reward-like item can be claimed right now. */
export function isClaimable(window: TimeWindow, now: Date | number): boolean {
  const state = computeRewardState(window, now);
  return state === 'AVAILABLE' || state === 'ENDING_SOON';
}

export function isActiveStatus(status: TimeStatus): boolean {
  return status === 'LIVE' || status === 'ENDING_SOON';
}
