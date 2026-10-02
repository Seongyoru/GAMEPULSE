import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../constants';
import { hoursFrom, makePulseItem, TEST_NOW } from '../testing/factories';
import { groupByTimeline, timelineGroupOf } from './groups';

const now = TEST_NOW;
const nowMs = now.getTime();

describe('timelineGroupOf', () => {
  it('groups ranged items by their window', () => {
    expect(
      timelineGroupOf(
        makePulseItem({ type: 'EVENT', startAt: hoursFrom(now, -5), endAt: hoursFrom(now, 5) }),
        nowMs,
      ),
    ).toBe('current');
    expect(
      timelineGroupOf(
        makePulseItem({ type: 'EVENT', startAt: hoursFrom(now, 5), endAt: hoursFrom(now, 50) }),
        nowMs,
      ),
    ).toBe('upcoming');
    expect(
      timelineGroupOf(
        makePulseItem({ type: 'REWARD', startAt: hoursFrom(now, -50), endAt: hoursFrom(now, -1) }),
        nowMs,
      ),
    ).toBe('recent');
  });

  it('treats patches as point-in-time releases', () => {
    expect(
      timelineGroupOf(
        makePulseItem({ type: 'PATCH', startAt: hoursFrom(now, -1), endAt: null }),
        nowMs,
      ),
    ).toBe('recent');
    expect(
      timelineGroupOf(
        makePulseItem({ type: 'PATCH', startAt: hoursFrom(now, 30), endAt: null }),
        nowMs,
      ),
    ).toBe('upcoming');
  });

  it('uses the maintenance state and retires implausibly long open maintenance', () => {
    expect(
      timelineGroupOf(
        makePulseItem({
          type: 'MAINTENANCE',
          startAt: hoursFrom(now, -1),
          endAt: hoursFrom(now, 1),
        }),
        nowMs,
      ),
    ).toBe('current');
    expect(
      timelineGroupOf(
        makePulseItem({ type: 'MAINTENANCE', startAt: hoursFrom(now, -30), endAt: null }),
        nowMs,
      ),
    ).toBe('recent');
  });
});

describe('groupByTimeline', () => {
  const items = [
    makePulseItem({
      id: 'a',
      type: 'EVENT',
      startAt: hoursFrom(now, -10),
      endAt: hoursFrom(now, 100),
    }),
    makePulseItem({
      id: 'b',
      type: 'EVENT',
      startAt: hoursFrom(now, -10),
      endAt: hoursFrom(now, 10),
    }),
    makePulseItem({ id: 'c', type: 'EVENT', startAt: hoursFrom(now, -10), endAt: null }),
    makePulseItem({
      id: 'd',
      type: 'EVENT',
      startAt: hoursFrom(now, 48),
      endAt: hoursFrom(now, 96),
    }),
    makePulseItem({
      id: 'e',
      type: 'EVENT',
      startAt: hoursFrom(now, 24),
      endAt: hoursFrom(now, 96),
    }),
    makePulseItem({
      id: 'f',
      type: 'EVENT',
      startAt: hoursFrom(now, -100),
      endAt: hoursFrom(now, -2),
    }),
    makePulseItem({
      id: 'g',
      type: 'EVENT',
      startAt: hoursFrom(now, -100),
      endAt: hoursFrom(now, -20),
    }),
    makePulseItem({
      id: 'far-future',
      type: 'EVENT',
      startAt: new Date(nowMs + 90 * DAY_MS).toISOString(),
      endAt: null,
    }),
    makePulseItem({
      id: 'long-ago',
      type: 'EVENT',
      startAt: new Date(nowMs - 90 * DAY_MS).toISOString(),
      endAt: new Date(nowMs - 60 * DAY_MS).toISOString(),
    }),
  ];

  it('orders each group by what matters next', () => {
    const groups = groupByTimeline(items, now);
    expect(groups.current.map((item) => item.id)).toEqual(['b', 'a', 'c']);
    expect(groups.upcoming.map((item) => item.id)).toEqual(['e', 'd']);
    expect(groups.recent.map((item) => item.id)).toEqual(['f', 'g']);
  });

  it('applies the recent limit', () => {
    expect(groupByTimeline(items, now, { recentLimit: 1 }).recent.map((item) => item.id)).toEqual([
      'f',
    ]);
  });
});
