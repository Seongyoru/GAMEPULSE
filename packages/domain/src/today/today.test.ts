import { describe, expect, it } from 'vitest';
import { buildCalendarMonth, collectCalendarEntries } from '../calendar/calendar';
import { hoursFrom, makePulseItem, makeResetRule, TEST_NOW } from '../testing/factories';
import { buildPulseStream } from './pulse';
import { buildGameSnapshot } from './snapshot';
import { buildToday, classifyTodayItem } from './today';

const now = TEST_NOW; // 2026-10-02 12:00 KST (Friday)

const items = [
  makePulseItem({ id: 'maint-live', type: 'MAINTENANCE', gameId: 'lostark', startAt: hoursFrom(now, -1), endAt: hoursFrom(now, 2) }),
  makePulseItem({ id: 'maint-next', type: 'MAINTENANCE', gameId: 'maplestory', startAt: hoursFrom(now, 40), endAt: hoursFrom(now, 46) }),
  makePulseItem({
    id: 'patch-new',
    type: 'PATCH',
    gameId: 'lol',
    startAt: hoursFrom(now, -20),
    facts: { version: '26.19', changeCount: 3 },
  }),
  makePulseItem({ id: 'patch-next', type: 'PATCH', gameId: 'lol', startAt: hoursFrom(now, 120), facts: { version: '26.20' } }),
  makePulseItem({ id: 'reward', type: 'REWARD', gameId: 'genshin', startAt: hoursFrom(now, -5), endAt: hoursFrom(now, 100) }),
  makePulseItem({ id: 'code', type: 'REDEEM_CODE', gameId: 'genshin', startAt: hoursFrom(now, -5), endAt: hoursFrom(now, 4) }),
  makePulseItem({ id: 'event-ending', type: 'EVENT', gameId: 'genshin', startAt: hoursFrom(now, -200), endAt: hoursFrom(now, 30) }),
  makePulseItem({ id: 'event-new', type: 'EVENT', gameId: 'wuwa', startAt: hoursFrom(now, -10), endAt: hoursFrom(now, 300) }),
  makePulseItem({ id: 'event-old', type: 'EVENT', gameId: 'wuwa', startAt: hoursFrom(now, -200), endAt: hoursFrom(now, 300) }),
  makePulseItem({ id: 'banner-next', type: 'BANNER', gameId: 'wuwa', startAt: hoursFrom(now, 50), endAt: hoursFrom(now, 400), facts: { featured: ['A'] } }),
  makePulseItem({ id: 'ended', type: 'EVENT', gameId: 'genshin', startAt: hoursFrom(now, -300), endAt: hoursFrom(now, -1) }),
  makePulseItem({ id: 'notice-hi', type: 'ANNOUNCEMENT', gameId: 'lostark', priority: 90, publishedAt: hoursFrom(now, -3) }),
  makePulseItem({ id: 'notice-lo', type: 'ANNOUNCEMENT', gameId: 'lostark', priority: 40, publishedAt: hoursFrom(now, -3) }),
];

const resets = [
  makeResetRule({ id: 'lostark-weekly', gameId: 'lostark', frequency: 'WEEKLY', dayOfWeek: 3, hour: 6 }),
  makeResetRule({ id: 'lostark-daily', gameId: 'lostark', frequency: 'DAILY', dayOfWeek: null, hour: 6, isPrimary: false }),
];

const ALL = ['lol', 'lostark', 'maplestory', 'genshin', 'wuwa'];

describe('classifyTodayItem', () => {
  it('places every item in at most one section', () => {
    const placed = Object.fromEntries(items.map((item) => [item.id, classifyTodayItem(item, now.getTime())]));
    expect(placed).toEqual({
      'maint-live': 'critical',
      'maint-next': 'maintenance',
      'patch-new': 'critical',
      'patch-next': 'upcoming',
      reward: 'rewards',
      code: 'rewards',
      'event-ending': 'endingSoon',
      'event-new': 'newEvents',
      'event-old': null,
      'banner-next': 'upcoming',
      ended: null,
      'notice-hi': 'critical',
      'notice-lo': null,
    });
  });
});

describe('buildToday', () => {
  it('builds urgency-ordered sections and summary counts', () => {
    const today = buildToday({ items, resets, now, gameIds: ALL });
    expect(today.sections.critical.map((e) => (e.kind === 'item' ? e.item.id : e.rule.id))).toEqual([
      'maint-live',
      'patch-new',
      'notice-hi',
    ]);
    // The code expiring within 6h ranks above the merely claimable reward.
    expect(today.sections.rewards.map((e) => (e.kind === 'item' ? e.item.id : ''))).toEqual(['code', 'reward']);
    expect(today.sections.resets.map((e) => (e.kind === 'reset' ? e.rule.id : ''))).toEqual([
      'lostark-daily',
      'lostark-weekly',
    ]);
    expect(today.summary).toEqual({ updates: 3, rewards: 2, resets: 1, endingSoon: 1, total: 7 });
  });

  it('filters by MY GAMES and dismissed items', () => {
    const today = buildToday({
      items,
      resets,
      now,
      gameIds: ['genshin'],
      options: { dismissedIds: ['reward'] },
    });
    expect(today.sections.rewards.map((e) => (e.kind === 'item' ? e.item.id : ''))).toEqual(['code']);
    expect(today.sections.resets).toHaveLength(0);
    expect(today.sections.critical).toHaveLength(0);
  });
});

describe('buildGameSnapshot', () => {
  it('summarizes a game generically', () => {
    const lol = buildGameSnapshot({ gameId: 'lol', items, resets, now });
    expect(lol.latestPatch).toMatchObject({ version: '26.19', changeCount: 3 });
    expect(lol.nextPatch).toMatchObject({ version: '26.20' });
    expect(lol.primaryReset).toBeNull();

    const lostark = buildGameSnapshot({ gameId: 'lostark', items, resets, now });
    expect(lostark.primaryReset?.ruleId).toBe('lostark-weekly');
    expect(lostark.upcomingResets[0]?.ruleId).toBe('lostark-daily');
    expect(lostark.maintenance?.state).toBe('IN_PROGRESS');

    const genshin = buildGameSnapshot({ gameId: 'genshin', items, resets, now });
    expect(genshin.rewardsAvailable).toBe(2);
    expect(genshin.currentEvents).toBe(1);
    expect(genshin.endingSoonEvent?.title).toBe(items[6]?.title);

    const wuwa = buildGameSnapshot({ gameId: 'wuwa', items, resets, now });
    expect(wuwa.currentEvents).toBe(2);
    expect(wuwa.currentBanner).toBeNull();
  });
});

describe('buildPulseStream', () => {
  it('collects moments around now in chronological order', () => {
    const stream = buildPulseStream({ items, resets, now });
    const kinds = stream.map((moment) => `${moment.kind}:${moment.item?.id ?? moment.title}`);
    expect(kinds).toContain('PATCH:patch-new');
    expect(kinds).toContain('EVENT_START:event-new');
    expect(kinds).toContain('MAINTENANCE:maint-live');
    expect(kinds).not.toContain('PATCH:patch-next'); // 120h ahead, outside the 48h window
    expect(stream.every((m, i, all) => i === 0 || Date.parse(all[i - 1]?.at ?? '') <= Date.parse(m.at))).toBe(true);
    expect(stream.some((m) => m.kind === 'RESET')).toBe(false); // weekly reset is >48h away, daily excluded
  });
});

describe('calendar', () => {
  it('collects start/end/release markers and non-daily resets', () => {
    const entries = collectCalendarEntries({
      items,
      resets,
      from: new Date('2026-10-01T00:00:00Z'),
      to: new Date('2026-10-31T00:00:00Z'),
    });
    expect(entries.find((e) => e.id === 'patch-next:RELEASE')).toBeDefined();
    expect(entries.find((e) => e.id === 'event-ending:END')).toBeDefined();
    expect(entries.filter((e) => e.marker === 'RESET').every((e) => e.title === '주간 초기화')).toBe(true);
  });

  it('builds a Sunday-first month grid in the viewer zone', () => {
    const month = buildCalendarMonth({ year: 2026, month: 10, timeZone: 'Asia/Seoul', now, items, resets });
    expect(month.weeks[0]?.[0]?.date).toBe('2026-09-27'); // Sunday before Oct 1 (Thursday)
    expect(month.weeks.every((week) => week.length === 7)).toBe(true);
    const today = month.weeks.flat().find((day) => day.isToday);
    expect(today?.date).toBe('2026-10-02');
    const oct7 = month.weeks.flat().find((day) => day.date === '2026-10-07');
    expect(oct7?.entries.some((entry) => entry.marker === 'RESET')).toBe(true);
  });
});
