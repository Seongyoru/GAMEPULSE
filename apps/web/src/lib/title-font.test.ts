import { readFileSync } from 'node:fs';
import { listGames, localizedText } from '@gamepulse/domain';
import { describe, expect, it } from 'vitest';

const subset = JSON.parse(
  readFileSync(new URL('../app/fonts/title-subset.json', import.meta.url), 'utf8'),
) as { characters: string };

describe('title font subset', () => {
  it('covers every character of every game title (run `pnpm fonts:titles` after adding a game)', () => {
    const covered = new Set(subset.characters);
    const missing = listGames()
      .flatMap((game) => [
        localizedText(game.localizedNames, 'ko-KR'),
        localizedText(game.shortNames, 'ko-KR'),
      ])
      .flatMap((title) => [...title.replace(/\s/g, '')])
      .filter((char) => !covered.has(char));
    expect([...new Set(missing)]).toEqual([]);
  });
});
