import { describe, expect, it } from 'vitest';
import { navMatch, normalizePath } from './nav';

describe('normalizePath', () => {
  it('drops trailing slashes but keeps the root', () => {
    expect(normalizePath('/today/')).toBe('/today');
    expect(normalizePath('/games/genshin-impact/patches/')).toBe('/games/genshin-impact/patches');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });
});

describe('navMatch', () => {
  it('marks the page itself, with or without the static-export trailing slash', () => {
    expect(navMatch('/today', '/today')).toBe('page');
    expect(navMatch('/today/', '/today')).toBe('page');
  });

  it('marks a section only for links that cover one', () => {
    expect(navMatch('/games/lostark/events', '/games', true)).toBe('section');
    expect(navMatch('/games/lostark/events', '/games')).toBeNull();
  });

  it('does not match prefixes that are not path segments', () => {
    expect(navMatch('/games-archive', '/games', true)).toBeNull();
    expect(navMatch('/my-games', '/games', true)).toBeNull();
  });

  it('marks nothing on the home page', () => {
    for (const href of ['/today', '/games', '/calendar', '/my-games']) {
      expect(navMatch('/', href, true)).toBeNull();
    }
  });
});
