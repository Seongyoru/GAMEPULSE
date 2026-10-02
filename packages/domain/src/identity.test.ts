import { describe, expect, it } from 'vitest';
import {
  buildContentSlug,
  fnv1a32,
  normalizeTitleForIdentity,
  semanticKey,
  slugify,
  slugWithSuffix,
  stableStringify,
} from './identity';
import { makeCandidate } from './testing/factories';

describe('stableStringify', () => {
  it('sorts keys recursively and drops undefined', () => {
    expect(stableStringify({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe(
      '{"a":{"d":[1,{"y":2,"z":1}]},"b":1}',
    );
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it('serializes dates by value', () => {
    expect(stableStringify({ at: new Date('2026-10-02T00:00:00Z') })).toBe('{"at":"2026-10-02T00:00:00.000Z"}');
    expect(stableStringify(new Date(0))).not.toBe(stableStringify(new Date(1)));
  });
});

describe('fnv1a32', () => {
  it('is stable and 8 hex chars', () => {
    expect(fnv1a32('gamepulse')).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1a32('gamepulse')).toBe(fnv1a32('gamepulse'));
    expect(fnv1a32('a')).not.toBe(fnv1a32('b'));
  });
});

describe('slugs', () => {
  it('slugifies to lowercase ASCII', () => {
    expect(slugify('Lantern Rite 2026!')).toBe('lantern-rite-2026');
    expect(slugify('Pokémon Café')).toBe('pokemon-cafe');
    expect(slugify('원신 이벤트')).toBe('');
  });

  it('builds patch slugs from the version and others from hints or keys', () => {
    expect(
      buildContentSlug({ gameSlug: 'league-of-legends', candidate: makeCandidate('PATCH', { patch: { version: '26.19', releaseAt: null, changes: [] } }) }),
    ).toBe('league-of-legends-patch-26-19');
    expect(
      buildContentSlug({ gameSlug: 'genshin-impact', candidate: makeCandidate('EVENT', { slugHint: 'lantern-rite' }) }),
    ).toBe('genshin-impact-event-lantern-rite');
    expect(
      buildContentSlug({ gameSlug: 'lost-ark', candidate: makeCandidate('EVENT', { sourceKey: '이벤트-12345' }) }),
    ).toBe('lost-ark-event-12345');
    expect(buildContentSlug({ gameSlug: 'lost-ark', candidate: makeCandidate('EVENT', { sourceKey: '이벤트' }) })).toMatch(
      /^lost-ark-event-[0-9a-f]{8}$/,
    );
  });

  it('adds a deterministic suffix on collision', () => {
    expect(slugWithSuffix('genshin-impact-event-x', 'seed')).toBe(`genshin-impact-event-x-${fnv1a32('seed')}`);
  });
});

describe('semantic identity', () => {
  it('ignores bracket tags, punctuation and case', () => {
    expect(normalizeTitleForIdentity('[이벤트] 해등절 축제!')).toBe(normalizeTitleForIdentity('해등절 축제 (수정)'));
  });

  it('keys patches by version and codes by code', () => {
    expect(semanticKey(makeCandidate('PATCH', { gameId: 'lol', patch: { version: '26.19 ', releaseAt: null, changes: [] } }))).toBe(
      'lol:PATCH:26.19',
    );
    expect(
      semanticKey(makeCandidate('REDEEM_CODE', { redeemCode: { code: 'gptest-abc1', region: null, items: [] } })),
    ).toBe('genshin:REDEEM_CODE:GPTEST-ABC1');
  });

  it('keys other content by title and UTC start day', () => {
    const a = makeCandidate('EVENT', { title: '[이벤트] 해등절', startAt: '2026-10-08T10:00:00+08:00' });
    const b = makeCandidate('EVENT', { title: '해등절', startAt: '2026-10-08T02:00:00Z', sourceKey: 'other' });
    expect(semanticKey(a)).toBe(semanticKey(b));
    expect(semanticKey(a)).toBe('genshin:EVENT:해등절:2026-10-08');
  });
});
