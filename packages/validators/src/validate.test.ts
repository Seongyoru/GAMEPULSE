import { makeCandidate, makeSource } from '@gamepulse/domain/testing';
import { describe, expect, it } from 'vitest';
import { parseSourceWallTime, validateCandidate, type ValidationContext } from './validate';
import { decidePublication } from './verification';

const NOW = new Date('2026-10-02T03:00:00Z');
const fixtureSource = makeSource();
const officialSource = makeSource({
  id: 'genshin-official',
  type: 'OFFICIAL_WEB',
  isOfficial: true,
  collectorStatus: 'DISABLED',
});

function context(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    now: NOW,
    source: fixtureSource,
    parserKind: 'fixture',
    documentText: null,
    ...overrides,
  };
}

const codes = (outcome: ReturnType<typeof validateCandidate>) => outcome.issues.map((i) => i.code);

describe('validateCandidate', () => {
  it('accepts a clean candidate', () => {
    const outcome = validateCandidate(
      makeCandidate('EVENT', { startAt: '2026-10-01T00:00:00Z', endAt: '2026-10-20T00:00:00Z' }),
      context(),
    );
    expect(outcome.status).toBe('VALID');
    expect(outcome.issues).toEqual([]);
  });

  it('rejects schema violations', () => {
    const outcome = validateCandidate({ kind: 'EVENT', title: '' }, context());
    expect(outcome.status).toBe('INVALID');
    expect(outcome.candidate).toBeNull();
    expect(codes(outcome).every((code) => code === 'SCHEMA')).toBe(true);
  });

  it('fails endAt < startAt', () => {
    const outcome = validateCandidate(
      makeCandidate('EVENT', { startAt: '2026-10-10T00:00:00Z', endAt: '2026-10-01T00:00:00Z' }),
      context(),
    );
    expect(outcome.status).toBe('INVALID');
    expect(codes(outcome)).toContain('END_BEFORE_START');
  });

  it('accepts a missing end date with a warning', () => {
    const outcome = validateCandidate(
      makeCandidate('EVENT', { startAt: '2026-10-01T00:00:00Z' }),
      context(),
    );
    expect(outcome.status).toBe('WARNING');
    expect(codes(outcome)).toEqual(['END_MISSING']);
  });

  it('flags impossible ranges for review', () => {
    const outcome = validateCandidate(
      makeCandidate('EVENT', { startAt: '2026-10-01T00:00:00Z', endAt: '2028-10-01T00:00:00Z' }),
      context(),
    );
    expect(outcome.status).toBe('REVIEW');
    expect(codes(outcome)).toContain('RANGE_TOO_LONG');
  });

  it('rejects content whose game does not match the source', () => {
    expect(validateCandidate(makeCandidate('EVENT', { gameId: 'lol' }), context()).status).toBe(
      'INVALID',
    );
  });

  it('requires source URLs on the allowlist', () => {
    const outcome = validateCandidate(
      makeCandidate('ANNOUNCEMENT', { sourceUrl: 'https://evil.example.com/x' }),
      context(),
    );
    expect(outcome.status).toBe('REVIEW');
    expect(codes(outcome)).toEqual(['SOURCE_URL_HOST']);
    expect(
      validateCandidate(
        makeCandidate('ANNOUNCEMENT', { sourceUrl: 'https://sub.genshin.hoyoverse.com/x' }),
        context(),
      ).status,
    ).toBe('VALID');
  });

  it('checks normalized times against the original source text and zone', () => {
    const timing = {
      sourceTimezone: 'UTC+8',
      startAtSource: '2026/10/08 10:00 (UTC+8)',
      endAtSource: '2026년 10월 21일 03:59',
      region: 'asia',
      precision: 'DATETIME' as const,
    };
    const ok = validateCandidate(
      makeCandidate('EVENT', {
        startAt: '2026-10-08T02:00:00Z',
        endAt: '2026-10-20T19:59:00Z',
        timing,
      }),
      context(),
    );
    expect(ok.status).toBe('VALID');

    const wrong = validateCandidate(
      makeCandidate('EVENT', {
        startAt: '2026-10-08T10:00:00Z',
        endAt: '2026-10-20T19:59:00Z',
        timing,
      }),
      context(),
    );
    expect(wrong.status).toBe('INVALID');
    expect(codes(wrong)).toEqual(['TIMEZONE_MISMATCH']);
  });

  it('keeps synthetic redeem codes clearly marked', () => {
    const unmarked = makeCandidate('REDEEM_CODE', {
      endAt: '2026-10-20T00:00:00Z',
      redeemCode: { code: 'REALLOOKING1', region: null, items: [] },
    });
    expect(codes(validateCandidate(unmarked, context()))).toContain('SYNTHETIC_CODE_UNMARKED');

    const fixtureNotSynthetic = makeCandidate('EVENT', {
      isSynthetic: false,
      endAt: '2026-10-20T00:00:00Z',
    });
    expect(codes(validateCandidate(fixtureNotSynthetic, context()))).toContain(
      'FIXTURE_NOT_SYNTHETIC',
    );
  });

  it('sends real redeem codes without official evidence to review', () => {
    const code = makeCandidate('REDEEM_CODE', {
      isSynthetic: false,
      endAt: '2026-10-20T00:00:00Z',
      redeemCode: { code: 'GENSHINGIFT', region: null, items: [] },
    });
    const withoutEvidence = validateCandidate(
      code,
      context({ source: officialSource, parserKind: 'deterministic' }),
    );
    expect(withoutEvidence.status).toBe('REVIEW');
    expect(codes(withoutEvidence)).toContain('CODE_WITHOUT_EVIDENCE');

    const withEvidence = validateCandidate(
      { ...code, evidence: [{ field: 'redeemCode.code', excerpt: '리딤코드: GENSHINGIFT' }] },
      context({ source: officialSource, parserKind: 'deterministic' }),
    );
    expect(withEvidence.status).toBe('VALID');
  });

  it('never auto-publishes AI output without verifiable evidence', () => {
    const ai = context({
      source: officialSource,
      parserKind: 'ai',
      documentText: '이벤트 기간: 2026/10/08 10:00 ~ 2026/10/20 03:59',
    });
    const candidate = makeCandidate('EVENT', {
      isSynthetic: false,
      startAt: '2026-10-08T02:00:00Z',
      endAt: '2026-10-19T19:59:00Z',
    });
    expect(codes(validateCandidate(candidate, ai))).toContain('AI_WITHOUT_EVIDENCE');

    const partial = { ...candidate, evidence: [{ field: 'startAt', excerpt: '2026/10/08 10:00' }] };
    expect(codes(validateCandidate(partial, ai))).toEqual(['AI_FIELD_WITHOUT_EVIDENCE']);

    const invented = {
      ...candidate,
      evidence: [
        { field: 'startAt', excerpt: '2026/10/08 10:00' },
        { field: 'endAt', excerpt: '2026/10/25 03:59' },
      ],
    };
    expect(codes(validateCandidate(invented, ai))).toEqual(['EVIDENCE_NOT_IN_SOURCE']);

    const grounded = {
      ...candidate,
      evidence: [
        { field: 'startAt', excerpt: '2026/10/08   10:00' },
        { field: 'endAt', excerpt: '2026/10/20 03:59' },
      ],
    };
    expect(validateCandidate(grounded, ai).status).toBe('VALID');
  });

  it('checks patch before/after pairs', () => {
    const outcome = validateCandidate(
      makeCandidate('PATCH', {
        patch: {
          version: '26.19',
          releaseAt: null,
          changes: [
            {
              targetType: 'CHAMPION',
              targetKey: 'ahri',
              targetName: '아리',
              changeType: 'BUFF',
              field: 'Q 피해량',
              beforeValue: '80',
              afterValue: '80',
              unit: null,
              description: null,
            },
          ],
        },
      }),
      context(),
    );
    expect(codes(outcome)).toEqual(['PATCH_VALUE_UNCHANGED']);
  });

  it('sanitizes titles and summaries', () => {
    const outcome = validateCandidate(
      makeCandidate('ANNOUNCEMENT', {
        title: '<b>공지</b>\n  사항',
        summary: '<script>x</script>요약',
      }),
      context(),
    );
    expect(outcome.candidate?.title).toBe('공지 사항');
    expect(outcome.candidate?.summary).toBe('요약');
  });
});

describe('parseSourceWallTime', () => {
  it.each([
    ['2026/10/08 10:00 (UTC+8)', { year: 2026, month: 10, day: 8, hour: 10, minute: 0 }],
    ['2026-10-08 04:59', { year: 2026, month: 10, day: 8, hour: 4, minute: 59 }],
    ['2026년 10월 8일 (수) 11:00', { year: 2026, month: 10, day: 8, hour: 11, minute: 0 }],
    ['2026.10.08 06:00', { year: 2026, month: 10, day: 8, hour: 6, minute: 0 }],
    ['2026-10-08T06:00:00', { year: 2026, month: 10, day: 8, hour: 6, minute: 0 }],
  ])('%s', (text, expected) => {
    expect(parseSourceWallTime(text)).toEqual(expected);
  });

  it('returns null without a time', () => {
    expect(parseSourceWallTime('버전 업데이트 후')).toBeNull();
    expect(parseSourceWallTime('2026/10/08')).toBeNull();
  });
});

describe('decidePublication', () => {
  it('separates verification from validation', () => {
    expect(decidePublication('INVALID', officialSource, 'deterministic')).toEqual({
      store: false,
      status: 'REJECTED',
      verification: 'REJECTED',
    });
    expect(decidePublication('REVIEW', officialSource, 'ai').status).toBe('PENDING_REVIEW');
    expect(decidePublication('VALID', officialSource, 'deterministic').verification).toBe(
      'AUTO_VERIFIED',
    );
    expect(decidePublication('WARNING', officialSource, 'ai').verification).toBe('AUTO_VERIFIED');
    expect(decidePublication('VALID', fixtureSource, 'fixture').verification).toBe('UNVERIFIED');
    expect(decidePublication('VALID', makeSource({ type: 'MANUAL' }), 'manual').verification).toBe(
      'MANUAL_VERIFIED',
    );
    expect(
      decidePublication('VALID', makeSource({ type: 'TRUSTED_FALLBACK' }), 'deterministic')
        .verification,
    ).toBe('UNVERIFIED');
  });
});
