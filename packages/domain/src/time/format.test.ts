import { describe, expect, it } from 'vitest';
import {
  formatClockDuration,
  formatCompactDateTime,
  formatDDay,
  formatRelativePast,
  formatRemaining,
  splitDuration,
  toIntlTimeZone,
} from './format';

const NOW = new Date('2026-10-02T03:00:00Z'); // 12:00 KST, Friday

describe('formatCompactDateTime', () => {
  it('formats in the viewer time zone with a Korean weekday', () => {
    expect(formatCompactDateTime('2026-10-07T21:00:00Z', 'Asia/Seoul', 'ko-KR')).toBe(
      '10.08 (목) 06:00',
    );
  });

  it('supports English weekdays and omitting the weekday', () => {
    expect(formatCompactDateTime('2026-10-07T21:00:00Z', 'Asia/Seoul', 'en-US')).toBe(
      '10.08 (Thu) 06:00',
    );
    expect(formatCompactDateTime('2026-10-07T21:00:00Z', 'UTC', 'ko-KR', { weekday: false })).toBe(
      '10.07 21:00',
    );
  });
});

describe('durations', () => {
  it('splits and formats clock durations', () => {
    const ms = (3 * 3600 + 42 * 60 + 18) * 1000;
    expect(splitDuration(ms)).toEqual({ days: 0, hours: 3, minutes: 42, seconds: 18 });
    expect(formatClockDuration(ms)).toBe('03:42:18');
    expect(formatClockDuration(-5)).toBe('00:00:00');
  });
});

describe('formatDDay', () => {
  it('uses calendar days in the viewer time zone', () => {
    expect(formatDDay('2026-10-02T14:00:00Z', NOW, 'Asia/Seoul')).toBe('D-DAY'); // 23:00 KST same day
    expect(formatDDay('2026-10-02T16:00:00Z', NOW, 'Asia/Seoul')).toBe('D-1'); // 01:00 KST next day
    expect(formatDDay('2026-10-15T03:00:00Z', NOW, 'Asia/Seoul')).toBe('D-13');
    expect(formatDDay('2026-09-30T03:00:00Z', NOW, 'Asia/Seoul')).toBe('D+2');
  });
});

describe('formatRemaining', () => {
  it('shows a clock under 24h, a D-day label beyond, and null when passed', () => {
    expect(formatRemaining('2026-10-02T06:42:18Z', NOW, 'Asia/Seoul')).toBe('03:42:18');
    expect(formatRemaining('2026-10-05T03:00:00Z', NOW, 'Asia/Seoul')).toBe('D-3');
    expect(formatRemaining('2026-10-02T02:00:00Z', NOW, 'Asia/Seoul')).toBeNull();
  });
});

describe('formatRelativePast', () => {
  it('produces short Korean and English phrases', () => {
    expect(formatRelativePast('2026-10-02T02:55:00Z', NOW, 'ko-KR')).toBe('5분 전');
    expect(formatRelativePast('2026-10-01T03:00:00Z', NOW, 'ko-KR')).toBe('1일 전');
    expect(formatRelativePast('2026-10-02T00:00:00Z', NOW, 'en-US')).toBe('3h ago');
  });
});

describe('toIntlTimeZone', () => {
  it('maps whole-hour fixed offsets to POSIX Etc zones', () => {
    expect(toIntlTimeZone('UTC+8')).toBe('Etc/GMT-8');
    expect(toIntlTimeZone('UTC-5')).toBe('Etc/GMT+5');
    expect(toIntlTimeZone('Asia/Seoul')).toBe('Asia/Seoul');
  });
});
