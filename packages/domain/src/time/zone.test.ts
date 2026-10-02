import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  calendarDayDiff,
  daysInMonth,
  describeTimeZone,
  formatCalendarDate,
  getOffsetMinutes,
  getWallTime,
  isoWeekday,
  isValidTimeZone,
  parseCalendarDate,
  parseFixedOffset,
  startOfIsoWeek,
  toCalendarDate,
  zonedTimeToUtc,
} from './zone';

describe('parseFixedOffset', () => {
  it.each([
    ['UTC', 0],
    ['GMT', 0],
    ['UTC+8', 480],
    ['UTC+08:00', 480],
    ['UTC+0800', 480],
    ['GMT-5', -300],
    ['+09:00', 540],
    ['UTC+5:30', 330],
  ])('%s → %i minutes', (input, expected) => {
    expect(parseFixedOffset(input)).toBe(expected);
  });

  it('returns null for IANA names and out-of-range offsets', () => {
    expect(parseFixedOffset('Asia/Seoul')).toBeNull();
    expect(parseFixedOffset('UTC+15')).toBeNull();
    expect(parseFixedOffset('UTC+8:75')).toBeNull();
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones and fixed offsets', () => {
    expect(isValidTimeZone('Asia/Seoul')).toBe(true);
    expect(isValidTimeZone('Etc/GMT-8')).toBe(true);
    expect(isValidTimeZone('UTC+8')).toBe(true);
  });

  it('rejects unknown zones and empty strings', () => {
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('offsets', () => {
  it('Asia/Seoul is UTC+9 year-round', () => {
    expect(getOffsetMinutes(new Date('2026-01-15T00:00:00Z'), 'Asia/Seoul')).toBe(540);
    expect(getOffsetMinutes(new Date('2026-07-15T00:00:00Z'), 'Asia/Seoul')).toBe(540);
  });

  it('America/New_York observes DST', () => {
    expect(getOffsetMinutes(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-300);
    expect(getOffsetMinutes(new Date('2026-07-15T12:00:00Z'), 'America/New_York')).toBe(-240);
  });

  it('fixed offsets and Etc zones agree', () => {
    const at = new Date('2026-10-02T00:00:00Z');
    expect(getOffsetMinutes(at, 'UTC+8')).toBe(480);
    expect(getOffsetMinutes(at, 'Etc/GMT-8')).toBe(480);
    expect(describeTimeZone('Asia/Seoul', at)).toBe('UTC+9');
    expect(describeTimeZone('UTC-5', at)).toBe('UTC-5');
  });
});

describe('getWallTime', () => {
  it('reads the local wall clock of an instant', () => {
    expect(getWallTime(new Date('2026-10-07T21:00:00Z'), 'Asia/Seoul')).toEqual({
      year: 2026,
      month: 10,
      day: 8,
      hour: 6,
      minute: 0,
      second: 0,
    });
  });

  it('handles midnight without producing hour 24', () => {
    expect(getWallTime(new Date('2026-10-07T15:00:00Z'), 'Asia/Seoul').hour).toBe(0);
  });
});

describe('zonedTimeToUtc', () => {
  it('converts KST wall time to UTC', () => {
    expect(
      zonedTimeToUtc({ year: 2026, month: 10, day: 8, hour: 6 }, 'Asia/Seoul').toISOString(),
    ).toBe('2026-10-07T21:00:00.000Z');
  });

  it('converts server time UTC+8 (Genshin/Wuthering Waves Asia) to UTC', () => {
    expect(zonedTimeToUtc({ year: 2026, month: 10, day: 5, hour: 4 }, 'UTC+8').toISOString()).toBe(
      '2026-10-04T20:00:00.000Z',
    );
  });

  it('moves wall times inside a DST gap forward (Temporal "compatible")', () => {
    // 2026-03-08 02:30 does not exist in New York; compatible → 03:30 EDT.
    expect(
      zonedTimeToUtc(
        { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-03-08T07:30:00.000Z');
  });

  it('resolves ambiguous wall times in a DST overlap to the earlier instant', () => {
    // 2026-11-01 01:30 happens twice in New York; earlier = EDT (UTC-4).
    expect(
      zonedTimeToUtc(
        { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-11-01T05:30:00.000Z');
  });

  it('round-trips with getWallTime', () => {
    const instant = zonedTimeToUtc(
      { year: 2026, month: 12, day: 31, hour: 23, minute: 59 },
      'Europe/Berlin',
    );
    expect(getWallTime(instant, 'Europe/Berlin')).toMatchObject({
      year: 2026,
      month: 12,
      day: 31,
      hour: 23,
      minute: 59,
    });
  });
});

describe('calendar arithmetic', () => {
  it('computes ISO weekdays', () => {
    expect(isoWeekday({ year: 2026, month: 10, day: 2 })).toBe(5); // Friday
    expect(isoWeekday({ year: 2026, month: 10, day: 7 })).toBe(3); // Wednesday
    expect(isoWeekday({ year: 2026, month: 11, day: 1 })).toBe(7); // Sunday
  });

  it('adds days and months across boundaries', () => {
    expect(addDays({ year: 2026, month: 12, day: 30 }, 3)).toEqual({
      year: 2027,
      month: 1,
      day: 2,
    });
    expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
  });

  it('counts calendar days and month lengths', () => {
    expect(
      calendarDayDiff({ year: 2026, month: 10, day: 2 }, { year: 2026, month: 10, day: 15 }),
    ).toBe(13);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(startOfIsoWeek({ year: 2026, month: 10, day: 2 })).toEqual({
      year: 2026,
      month: 9,
      day: 28,
    });
  });

  it('derives the local date of an instant', () => {
    // 2026-10-02T16:00Z is already Oct 3 in Seoul.
    expect(toCalendarDate(new Date('2026-10-02T16:00:00Z'), 'Asia/Seoul')).toEqual({
      year: 2026,
      month: 10,
      day: 3,
    });
  });

  it('parses and formats calendar dates strictly', () => {
    expect(formatCalendarDate(parseCalendarDate('2026-10-02'))).toBe('2026-10-02');
    expect(() => parseCalendarDate('2026-02-30')).toThrow(RangeError);
    expect(() => parseCalendarDate('2026/10/02')).toThrow(RangeError);
  });
});
