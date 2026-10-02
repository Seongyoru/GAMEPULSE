import { describe, expect, it } from 'vitest';
import { contentPath, routeFamilyForType, toPulseItem } from './content';
import { CONTENT_TYPES } from './enums';
import { GAMES, getGameBySlug, isGameId, requireGame } from './games/registry';
import { applyContentQuery, matchesWindow } from './query';
import { sanitizePlainText, truncateText } from './text';
import { hoursFrom, makeContentRecord, TEST_NOW } from './testing/factories';
import { isValidTimeZone } from './time/zone';

describe('game registry', () => {
  it('has unique ids and slugs with valid zones and default regions', () => {
    expect(new Set(GAMES.map((g) => g.gameId)).size).toBe(GAMES.length);
    expect(new Set(GAMES.map((g) => g.slug)).size).toBe(GAMES.length);
    for (const game of GAMES) {
      expect(isValidTimeZone(game.timezone)).toBe(true);
      expect(game.regions.filter((r) => r.isDefault)).toHaveLength(1);
      expect(game.regions.every((r) => isValidTimeZone(r.timezone))).toBe(true);
      expect(game.adapters.length).toBeGreaterThan(0);
      expect(game.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('supports the five MVP games', () => {
    expect(GAMES.map((g) => g.gameId)).toEqual(['lol', 'lostark', 'maplestory', 'genshin', 'wuwa']);
    expect(getGameBySlug('genshin-impact')?.gameId).toBe('genshin');
    expect(isGameId('wuwa')).toBe(true);
    expect(() => requireGame('nope')).toThrow();
  });
});

describe('content routing', () => {
  it('maps every type to one canonical family', () => {
    for (const type of CONTENT_TYPES) expect(routeFamilyForType(type)).toBeTruthy();
    expect(contentPath({ type: 'PATCH', slug: 'x' })).toBe('/patches/x');
    expect(contentPath({ type: 'BANNER', slug: 'x' })).toBe('/events/x');
    expect(contentPath({ type: 'REDEEM_CODE', slug: 'x' })).toBe('/rewards/x');
    expect(contentPath({ type: 'MAINTENANCE', slug: 'x' })).toBe('/notices/x');
  });

  it('projects records to compact pulse items', () => {
    const record = makeContentRecord({
      type: 'PATCH',
      detail: {
        type: 'PATCH',
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
            afterValue: '90',
            unit: null,
            description: null,
          },
        ],
      },
    });
    expect(toPulseItem(record).facts).toEqual({
      version: '26.19',
      changeCount: 1,
      changeHighlights: ['아리 Q 피해량 80 → 90'],
    });
  });
});

describe('content query semantics', () => {
  const window = { from: hoursFrom(TEST_NOW, -24), to: hoursFrom(TEST_NOW, 24) };

  it('matches point-in-time types by effective time and ranged types by overlap', () => {
    expect(matchesWindow(makeContentRecord({ type: 'PATCH', startAt: hoursFrom(TEST_NOW, -2) }), window)).toBe(true);
    expect(matchesWindow(makeContentRecord({ type: 'PATCH', startAt: hoursFrom(TEST_NOW, -48) }), window)).toBe(false);
    expect(
      matchesWindow(makeContentRecord({ type: 'EVENT', startAt: hoursFrom(TEST_NOW, -500), endAt: hoursFrom(TEST_NOW, 500) }), window),
    ).toBe(true);
    expect(
      matchesWindow(makeContentRecord({ type: 'EVENT', startAt: hoursFrom(TEST_NOW, -500), endAt: hoursFrom(TEST_NOW, -30) }), window),
    ).toBe(false);
    expect(matchesWindow(makeContentRecord({ type: 'EVENT', startAt: hoursFrom(TEST_NOW, -500), endAt: null }), window)).toBe(true);
  });

  it('filters, orders and limits', () => {
    const records = [
      makeContentRecord({ id: 'a', type: 'EVENT', startAt: hoursFrom(TEST_NOW, -1) }),
      makeContentRecord({ id: 'b', type: 'EVENT', startAt: hoursFrom(TEST_NOW, -3), gameId: 'lol' }),
      makeContentRecord({ id: 'c', type: 'EVENT', startAt: hoursFrom(TEST_NOW, -2), status: 'PENDING_REVIEW' }),
      makeContentRecord({ id: 'd', type: 'PATCH', startAt: hoursFrom(TEST_NOW, -4), isSynthetic: false }),
    ];
    expect(applyContentQuery(records, {}).map((r) => r.id)).toEqual(['a', 'b', 'd']);
    expect(applyContentQuery(records, { order: 'start' }).map((r) => r.id)).toEqual(['d', 'b', 'a']);
    expect(applyContentQuery(records, { gameIds: ['lol'] }).map((r) => r.id)).toEqual(['b']);
    expect(applyContentQuery(records, { types: ['PATCH'] }).map((r) => r.id)).toEqual(['d']);
    expect(applyContentQuery(records, { includeSynthetic: false }).map((r) => r.id)).toEqual(['d']);
    expect(applyContentQuery(records, { statuses: ['PENDING_REVIEW'] }).map((r) => r.id)).toEqual(['c']);
    expect(applyContentQuery(records, { limit: 1 }).map((r) => r.id)).toEqual(['a']);
  });
});

describe('text sanitization', () => {
  it('strips markup, scripts, entities and control characters', () => {
    expect(sanitizePlainText('<p>Hello&nbsp;<b>world</b></p><script>alert(1)</script>\u0007 &amp; more')).toBe(
      'Hello world & more',
    );
    expect(sanitizePlainText('line<br>break')).toBe('line\nbreak');
    expect(sanitizePlainText('&#xD55C;&#44544;')).toBe('한글');
  });

  it('truncates by characters with an ellipsis', () => {
    expect(truncateText('가나다라마바사', 5)).toBe('가나다라…');
    expect(truncateText('short', 10)).toBe('short');
  });
});
