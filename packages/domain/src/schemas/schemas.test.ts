import { describe, expect, it } from 'vitest';
import { makeCandidate, makeResetRule, makeSource } from '../testing/factories';
import { normalizedCandidateSchema } from './candidate';
import { parseManualItems } from './manual';
import { defaultPreferences, effectiveGameIds, sanitizePreferences } from './preferences';
import { resetRuleDefinitionSchema } from './reset';
import { sourceDefinitionSchema } from './source';

describe('normalizedCandidateSchema', () => {
  it('accepts every factory candidate kind', () => {
    for (const kind of ['PATCH', 'UPDATE', 'EVENT', 'REWARD', 'REDEEM_CODE', 'MAINTENANCE', 'BANNER', 'ANNOUNCEMENT'] as const) {
      expect(normalizedCandidateSchema.safeParse(makeCandidate(kind)).success).toBe(true);
    }
  });

  it('rejects non-http source URLs, unknown kinds and malformed dates', () => {
    expect(normalizedCandidateSchema.safeParse({ ...makeCandidate('EVENT'), sourceUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(normalizedCandidateSchema.safeParse({ ...makeCandidate('EVENT'), kind: 'RUMOR' }).success).toBe(false);
    expect(normalizedCandidateSchema.safeParse({ ...makeCandidate('EVENT'), startAt: '2026-10-08 10:00' }).success).toBe(false);
  });

  it('accepts offset datetimes and preserved source timing', () => {
    const parsed = normalizedCandidateSchema.safeParse(
      makeCandidate('EVENT', {
        startAt: '2026-10-08T10:00:00+08:00',
        timing: {
          sourceTimezone: 'UTC+8',
          startAtSource: '2026/10/08 10:00 (UTC+8)',
          endAtSource: null,
          region: 'asia',
          precision: 'DATETIME',
        },
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it('validates redeem code shape', () => {
    const bad = makeCandidate('REDEEM_CODE', { redeemCode: { code: 'no spaces allowed', region: null, items: [] } });
    expect(normalizedCandidateSchema.safeParse(bad).success).toBe(false);
  });
});

describe('sourceDefinitionSchema', () => {
  it('accepts a complete definition and rejects bad ids', () => {
    expect(sourceDefinitionSchema.safeParse(makeSource()).success).toBe(true);
    expect(sourceDefinitionSchema.safeParse(makeSource({ id: 'Bad Id' })).success).toBe(false);
  });
});

describe('resetRuleDefinitionSchema', () => {
  it('requires the fields of its frequency', () => {
    expect(resetRuleDefinitionSchema.safeParse(makeResetRule()).success).toBe(true);
    expect(resetRuleDefinitionSchema.safeParse(makeResetRule({ dayOfWeek: null })).success).toBe(false);
    expect(
      resetRuleDefinitionSchema.safeParse(makeResetRule({ frequency: 'MONTHLY', dayOfWeek: null, dayOfMonth: null }))
        .success,
    ).toBe(false);
    expect(resetRuleDefinitionSchema.safeParse(makeResetRule({ timezone: 'Nowhere/Zone' })).success).toBe(false);
  });

  it('requires a cited source for verified rules', () => {
    expect(resetRuleDefinitionSchema.safeParse(makeResetRule({ verification: 'MANUAL_VERIFIED' })).success).toBe(false);
    expect(
      resetRuleDefinitionSchema.safeParse(
        makeResetRule({ verification: 'MANUAL_VERIFIED', sourceUrl: 'https://example.com/guide' }),
      ).success,
    ).toBe(true);
  });
});

describe('preferences', () => {
  it('sanitizes untrusted stored data', () => {
    const prefs = sanitizePreferences({
      selectedGameIds: ['genshin', 'genshin', 'unknown-game', 42, 'lol'],
      timezone: 'Not/AZone',
      locale: 'xx-XX',
      dismissedPulseIds: ['a', 1],
      configuredAt: 'yesterday',
    });
    expect(prefs).toEqual({
      ...defaultPreferences(),
      selectedGameIds: ['genshin', 'lol'],
      dismissedPulseIds: ['a'],
    });
    expect(sanitizePreferences(null)).toEqual(defaultPreferences());
  });

  it('falls back to defaults when no game is selected', () => {
    expect(effectiveGameIds(defaultPreferences(), ['lol', 'genshin'])).toEqual(['lol', 'genshin']);
    expect(effectiveGameIds({ ...defaultPreferences(), selectedGameIds: ['wuwa'] }, ['lol'])).toEqual(['wuwa']);
  });
});

describe('manual ingestion items', () => {
  it('fills conveniences and reports per-item errors', () => {
    const { candidates, errors } = parseManualItems(
      {
        gameId: 'genshin',
        items: [
          {
            kind: 'EVENT',
            title: '해등절',
            sourceUrl: 'https://genshin.hoyoverse.com/ko/news',
            startAt: '2026-10-08T02:00:00Z',
            event: { eventType: 'IN_GAME', eligibility: null, rewardSummary: null, rewards: [] },
          },
          { kind: 'EVENT', title: 'missing url' },
        ],
      },
      'ko-KR',
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ gameId: 'genshin', isSynthetic: false, confidence: 1, sourceLocale: 'ko-KR' });
    expect(candidates[0]?.sourceKey).toMatch(/^manual-[0-9a-f]{8}$/);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.index).toBe(1);
  });
});
