import { describe, expect, it } from 'vitest';
import { parseSourceDateTime } from './time';

describe('parseSourceDateTime', () => {
  it('interprets offset-less values in the source zone and keeps the original text', () => {
    expect(parseSourceDateTime('2026-10-08T06:00:00', 'Asia/Seoul')).toEqual({
      iso: '2026-10-07T21:00:00.000Z',
      sourceText: '2026-10-08T06:00:00',
    });
    expect(parseSourceDateTime('2026-10-08 06:00', 'UTC+8')?.iso).toBe('2026-10-07T22:00:00.000Z');
    expect(parseSourceDateTime('2026-10-08', 'Asia/Seoul')?.iso).toBe('2026-10-07T15:00:00.000Z');
  });

  it('honours explicit offsets', () => {
    expect(parseSourceDateTime('2026-10-08T06:00:00+09:00', 'UTC+8')?.iso).toBe(
      '2026-10-07T21:00:00.000Z',
    );
    expect(parseSourceDateTime('2026-10-08T06:00:00Z', 'Asia/Seoul')?.iso).toBe(
      '2026-10-08T06:00:00.000Z',
    );
  });

  it('returns null for empty, malformed and "no end" sentinel values', () => {
    for (const value of [
      null,
      undefined,
      '',
      '  ',
      'soon',
      '2026-13-01T00:00:00',
      '9999-12-31T23:59:59',
    ]) {
      expect(parseSourceDateTime(value, 'Asia/Seoul')).toBeNull();
    }
  });
});
