import { describe, expect, it } from 'vitest';
import { hoursFrom, TEST_NOW } from '../testing/factories';
import { compareUrgency, computeItemUrgency, computeResetUrgency, type UrgencyInput } from './urgency';

const now = TEST_NOW;

function input(overrides: Partial<UrgencyInput>): UrgencyInput {
  return {
    type: 'EVENT',
    startAt: null,
    endAt: null,
    publishedAt: hoursFrom(now, -200),
    sourcePublishedAt: null,
    priority: 50,
    ...overrides,
  };
}

describe('computeItemUrgency', () => {
  it('follows the spec ordering', () => {
    const cases: Array<[UrgencyInput, string]> = [
      [input({ type: 'MAINTENANCE', startAt: hoursFrom(now, -1), endAt: hoursFrom(now, 2) }), 'MAINTENANCE_LIVE'],
      [input({ type: 'EVENT', startAt: hoursFrom(now, -100), endAt: hoursFrom(now, 5) }), 'EXPIRES_6H'],
      [input({ type: 'REWARD', startAt: hoursFrom(now, -1), endAt: hoursFrom(now, 72) }), 'CLAIMABLE_REWARD'],
      [input({ type: 'BANNER', startAt: hoursFrom(now, -100), endAt: hoursFrom(now, 20) }), 'EXPIRES_24H'],
      [input({ type: 'PATCH', startAt: hoursFrom(now, -24) }), 'NEW_PATCH'],
      [input({ type: 'EVENT', startAt: hoursFrom(now, -24), endAt: hoursFrom(now, 200) }), 'NEW_EVENT'],
      [input({ type: 'EVENT', startAt: hoursFrom(now, 24), endAt: hoursFrom(now, 200) }), 'UPCOMING'],
      [input({ type: 'EVENT', startAt: hoursFrom(now, -100), endAt: hoursFrom(now, 200) }), 'ONGOING'],
      [input({ type: 'EVENT', startAt: hoursFrom(now, -100), endAt: hoursFrom(now, -1) }), 'NONE'],
    ];
    for (const [item, reason] of cases) {
      expect(computeItemUrgency(item, now).reason).toBe(reason);
    }
  });

  it('expiring rewards outrank merely claimable ones', () => {
    const expiring = computeItemUrgency(input({ type: 'REDEEM_CODE', startAt: hoursFrom(now, -5), endAt: hoursFrom(now, 3) }), now);
    expect(expiring.reason).toBe('EXPIRES_6H');
  });

  it('old patches are not "new"', () => {
    expect(computeItemUrgency(input({ type: 'PATCH', startAt: hoursFrom(now, -100) }), now).reason).toBe('ONGOING');
  });
});

describe('computeResetUrgency', () => {
  it('flags resets within 24 hours', () => {
    expect(computeResetUrgency(new Date(hoursFrom(now, 5)), now).reason).toBe('RESET_24H');
    expect(computeResetUrgency(new Date(hoursFrom(now, 30)), now).reason).toBe('UPCOMING');
  });
});

describe('compareUrgency', () => {
  it('sorts by tier, then soonest instant, then priority', () => {
    const a = { urgency: { tier: 3, reason: 'CLAIMABLE_REWARD' as const, at: 2000 }, priority: 50 };
    const b = { urgency: { tier: 2, reason: 'EXPIRES_6H' as const, at: 9000 }, priority: 50 };
    const c = { urgency: { tier: 3, reason: 'CLAIMABLE_REWARD' as const, at: 1000 }, priority: 10 };
    const d = { urgency: { tier: 3, reason: 'CLAIMABLE_REWARD' as const, at: 1000 }, priority: 90 };
    expect([a, b, c, d].sort(compareUrgency)).toEqual([b, d, c, a]);
  });
});
