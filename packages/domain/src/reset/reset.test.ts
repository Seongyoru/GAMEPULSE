import { describe, expect, it } from 'vitest';
import { makeResetRule } from '../testing/factories';
import { describeSchedule } from './describe';
import { nextOccurrence, occurrencesBetween, previousOccurrence, validateSchedule } from './engine';
import { parseRRule, RRuleError } from './rrule';

const FRI_NOON_KST = new Date('2026-10-02T03:00:00Z');

describe('parseRRule', () => {
  it('parses the supported subset', () => {
    expect(parseRRule('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;BYHOUR=4;BYMINUTE=0')).toEqual({
      freq: 'WEEKLY',
      interval: 2,
      byDay: [{ weekday: 1, ordinal: null }],
      byMonthDay: [],
      byHour: [4],
      byMinute: [0],
      until: null,
    });
    expect(parseRRule('FREQ=MONTHLY;BYDAY=-1FR').byDay).toEqual([{ weekday: 5, ordinal: -1 }]);
    expect(parseRRule('FREQ=DAILY;UNTIL=20261231').until?.toISOString()).toBe('2026-12-31T23:59:59.000Z');
  });

  it.each([
    ['', 'Empty RRULE'],
    ['FREQ=YEARLY', 'FREQ must be'],
    ['FREQ=DAILY;COUNT=5', 'Unsupported RRULE part: COUNT'],
    ['FREQ=WEEKLY;BYDAY=1MO', 'ordinals are only supported'],
    ['FREQ=WEEKLY;BYMONTHDAY=1', 'only supported with FREQ=MONTHLY'],
    ['FREQ=MONTHLY;BYMONTHDAY=0', 'out of range'],
    ['FREQ=DAILY;INTERVAL=0', 'INTERVAL must be'],
    ['FREQ=WEEKLY;WKST=SU', 'Only WKST=MO'],
    ['FREQ=DAILY;FREQ=WEEKLY', 'Duplicate'],
  ])('rejects %j', (input, message) => {
    expect(() => parseRRule(input)).toThrow(RRuleError);
    expect(() => parseRRule(input)).toThrow(message);
  });
});

describe('fixed-frequency schedules', () => {
  it('WEEKLY Wednesday 06:00 KST', () => {
    const rule = makeResetRule({ frequency: 'WEEKLY', dayOfWeek: 3, hour: 6, timezone: 'Asia/Seoul' });
    expect(nextOccurrence(rule, FRI_NOON_KST)?.toISOString()).toBe('2026-10-06T21:00:00.000Z');
    // Strictly after: asking at the occurrence itself yields the following week.
    expect(nextOccurrence(rule, new Date('2026-10-06T21:00:00Z'))?.toISOString()).toBe('2026-10-13T21:00:00.000Z');
    expect(previousOccurrence(rule, FRI_NOON_KST)?.toISOString()).toBe('2026-09-29T21:00:00.000Z');
  });

  it('DAILY 04:00 server time UTC+8', () => {
    const rule = makeResetRule({ frequency: 'DAILY', dayOfWeek: null, hour: 4, timezone: 'UTC+8' });
    expect(nextOccurrence(rule, FRI_NOON_KST)?.toISOString()).toBe('2026-10-02T20:00:00.000Z');
    const week = occurrencesBetween(rule, FRI_NOON_KST, new Date('2026-10-09T03:00:00Z'));
    expect(week).toHaveLength(7);
  });

  it('MONTHLY on the 31st skips shorter months; -1 means the last day', () => {
    const on31 = makeResetRule({ frequency: 'MONTHLY', dayOfWeek: null, dayOfMonth: 31, hour: 0, timezone: 'Asia/Seoul' });
    expect(nextOccurrence(on31, new Date('2026-10-31T00:00:00Z'))?.toISOString()).toBe('2026-12-30T15:00:00.000Z');
    const last = makeResetRule({ frequency: 'MONTHLY', dayOfWeek: null, dayOfMonth: -1, hour: 0, timezone: 'Asia/Seoul' });
    expect(nextOccurrence(last, new Date('2027-02-01T00:00:00Z'))?.toISOString()).toBe('2027-02-27T15:00:00.000Z');
  });

  it('stays correct across a DST transition', () => {
    const rule = makeResetRule({ frequency: 'WEEKLY', dayOfWeek: 7, hour: 2, minute: 30, timezone: 'America/New_York' });
    // Sunday 2026-03-08 02:30 does not exist → 03:30 EDT (07:30Z)
    expect(nextOccurrence(rule, new Date('2026-03-07T00:00:00Z'))?.toISOString()).toBe('2026-03-08T07:30:00.000Z');
    expect(nextOccurrence(rule, new Date('2026-03-09T00:00:00Z'))?.toISOString()).toBe('2026-03-15T06:30:00.000Z');
  });
});

describe('CUSTOM_RRULE schedules', () => {
  it('1st and 16th of the month at 04:00 UTC+8', () => {
    const rule = makeResetRule({
      frequency: 'CUSTOM_RRULE',
      dayOfWeek: null,
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=1,16',
      hour: 4,
      timezone: 'UTC+8',
    });
    expect(nextOccurrence(rule, FRI_NOON_KST)?.toISOString()).toBe('2026-10-15T20:00:00.000Z');
    expect(nextOccurrence(rule, new Date('2026-10-15T20:00:00Z'))?.toISOString()).toBe('2026-10-31T20:00:00.000Z');
  });

  it('bi-weekly Monday 04:00 anchored to a DTSTART', () => {
    const rule = makeResetRule({
      frequency: 'CUSTOM_RRULE',
      dayOfWeek: null,
      rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
      anchor: '2026-09-28T04:00:00+08:00',
      hour: 4,
      timezone: 'UTC+8',
    });
    expect(nextOccurrence(rule, FRI_NOON_KST)?.toISOString()).toBe('2026-10-11T20:00:00.000Z');
    expect(nextOccurrence(rule, new Date('2026-10-11T20:00:00Z'))?.toISOString()).toBe('2026-10-25T20:00:00.000Z');
    // Never before the anchor.
    expect(nextOccurrence(rule, new Date('2026-09-01T00:00:00Z'))?.toISOString()).toBe('2026-09-27T20:00:00.000Z');
  });

  it('last Friday of the month', () => {
    const rule = makeResetRule({
      frequency: 'CUSTOM_RRULE',
      dayOfWeek: null,
      rrule: 'FREQ=MONTHLY;BYDAY=-1FR;BYHOUR=10;BYMINUTE=0',
      timezone: 'Asia/Seoul',
    });
    expect(nextOccurrence(rule, FRI_NOON_KST)?.toISOString()).toBe('2026-10-30T01:00:00.000Z');
  });

  it('multiple times per day via BYHOUR', () => {
    const rule = makeResetRule({
      frequency: 'CUSTOM_RRULE',
      dayOfWeek: null,
      rrule: 'FREQ=DAILY;BYHOUR=0,12',
      minute: 0,
      timezone: 'Asia/Seoul',
    });
    // [from, to): the 12:00 KST occurrence at `from` itself is included.
    expect(occurrencesBetween(rule, FRI_NOON_KST, new Date('2026-10-03T15:00:01Z')).map((d) => d.toISOString())).toEqual([
      '2026-10-02T03:00:00.000Z',
      '2026-10-02T15:00:00.000Z',
      '2026-10-03T03:00:00.000Z',
      '2026-10-03T15:00:00.000Z',
    ]);
  });

  it('honours UNTIL', () => {
    const rule = makeResetRule({
      frequency: 'CUSTOM_RRULE',
      dayOfWeek: null,
      rrule: 'FREQ=DAILY;UNTIL=20261002T120000Z',
      hour: 6,
      timezone: 'Asia/Seoul',
    });
    expect(nextOccurrence(rule, FRI_NOON_KST)).toBeNull();
  });

  it('reports invalid schedules instead of mis-computing', () => {
    const noAnchor = makeResetRule({ frequency: 'CUSTOM_RRULE', dayOfWeek: null, rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO' });
    expect(validateSchedule(noAnchor)).toEqual(['INTERVAL > 1 requires an anchor (DTSTART)']);
    expect(validateSchedule(makeResetRule())).toEqual([]);
  });
});

describe('describeSchedule', () => {
  it('describes schedules in Korean and English', () => {
    expect(describeSchedule(makeResetRule(), 'ko-KR')).toBe('매주 수요일 06:00');
    expect(describeSchedule(makeResetRule(), 'en-US')).toBe('Every Wed 06:00');
    expect(describeSchedule(makeResetRule({ frequency: 'DAILY', dayOfWeek: null }), 'ko-KR')).toBe('매일 06:00');
    expect(
      describeSchedule(
        makeResetRule({ frequency: 'CUSTOM_RRULE', rrule: 'FREQ=MONTHLY;BYMONTHDAY=1,16', hour: 4 }),
        'ko-KR',
      ),
    ).toBe('매월 1일·16일 04:00');
    expect(
      describeSchedule(
        makeResetRule({ frequency: 'CUSTOM_RRULE', rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO', hour: 4 }),
        'ko-KR',
      ),
    ).toBe('격주 월요일 04:00');
  });
});
