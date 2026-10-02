import { describe, expect, it } from 'vitest';
import { hoursFrom, TEST_NOW } from '../testing/factories';
import {
  computeMaintenanceState,
  computeRewardState,
  computeStatusForType,
  computeTimeStatus,
  isClaimable,
} from './status';

const now = TEST_NOW;

describe('computeTimeStatus', () => {
  it('is UNKNOWN without any dates', () => {
    expect(computeTimeStatus({ startAt: null, endAt: null }, now)).toBe('UNKNOWN');
  });

  it('is UPCOMING before the start', () => {
    expect(computeTimeStatus({ startAt: hoursFrom(now, 1), endAt: hoursFrom(now, 100) }, now)).toBe('UPCOMING');
  });

  it('is LIVE between start and the ending-soon threshold', () => {
    expect(computeTimeStatus({ startAt: hoursFrom(now, -1), endAt: hoursFrom(now, 49) }, now)).toBe('LIVE');
    expect(computeTimeStatus({ startAt: hoursFrom(now, -1), endAt: null }, now)).toBe('LIVE');
  });

  it('is ENDING_SOON within 48 hours of the end', () => {
    expect(computeTimeStatus({ startAt: hoursFrom(now, -10), endAt: hoursFrom(now, 47) }, now)).toBe('ENDING_SOON');
  });

  it('is ENDED at or after the end', () => {
    expect(computeTimeStatus({ startAt: null, endAt: now.toISOString() }, now)).toBe('ENDED');
  });

  it('respects per-type thresholds (maintenance never ENDING_SOON)', () => {
    expect(computeStatusForType('MAINTENANCE', { startAt: hoursFrom(now, -1), endAt: hoursFrom(now, 1) }, now)).toBe(
      'LIVE',
    );
  });
});

describe('reward state', () => {
  it('maps time status to reward states', () => {
    expect(computeRewardState({ startAt: hoursFrom(now, -1), endAt: hoursFrom(now, 100) }, now)).toBe('AVAILABLE');
    expect(computeRewardState({ startAt: hoursFrom(now, -1), endAt: hoursFrom(now, 10) }, now)).toBe('ENDING_SOON');
    expect(computeRewardState({ startAt: hoursFrom(now, 1), endAt: null }, now)).toBe('UPCOMING');
    expect(computeRewardState({ startAt: null, endAt: hoursFrom(now, -1) }, now)).toBe('EXPIRED');
    expect(computeRewardState({ startAt: null, endAt: null }, now)).toBe('UNKNOWN');
    expect(isClaimable({ startAt: hoursFrom(now, -1), endAt: hoursFrom(now, 10) }, now)).toBe(true);
  });
});

describe('maintenance state', () => {
  it('reports scheduled, in-progress and completed maintenance', () => {
    expect(computeMaintenanceState({ startAt: hoursFrom(now, 2), endAt: hoursFrom(now, 6) }, now)).toBe('SCHEDULED');
    expect(computeMaintenanceState({ startAt: hoursFrom(now, -1), endAt: hoursFrom(now, 3) }, now)).toBe('IN_PROGRESS');
    expect(computeMaintenanceState({ startAt: hoursFrom(now, -6), endAt: hoursFrom(now, -1) }, now)).toBe('COMPLETED');
  });

  it('does not report open-ended maintenance as in progress forever', () => {
    expect(computeMaintenanceState({ startAt: hoursFrom(now, -2), endAt: null }, now)).toBe('IN_PROGRESS');
    expect(computeMaintenanceState({ startAt: hoursFrom(now, -13), endAt: null }, now)).toBe('UNKNOWN');
  });
});
