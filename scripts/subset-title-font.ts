/**
 * Builds the title font: Black Han Sans (OFL-1.1) cut down to the characters of every registered
 * game's Korean name and short name. Title cards then download a few KB instead of the ~190 KB
 * full Korean face. Run `pnpm fonts:titles` after adding or renaming a game; a unit test fails
 * while a game name has characters the subset lacks. The font's licence is copied next to it.
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { listGames, localizedText } from '../packages/domain/src/index';
import subsetFont from 'subset-font';

const OUT_DIR = resolve(import.meta.dirname, '../apps/web/src/app/fonts');
const require = createRequire(import.meta.url);
const source =
  require.resolve('@fontsource/black-han-sans/files/black-han-sans-korean-400-normal.woff2');

const titles = listGames().flatMap((game) => [
  localizedText(game.localizedNames, 'ko-KR'),
  localizedText(game.shortNames, 'ko-KR'),
]);
const characters = [...new Set(titles.join('').replace(/\s/g, ''))].sort().join('');

const subset = await subsetFont(readFileSync(source), characters, { targetFormat: 'woff2' });
writeFileSync(resolve(OUT_DIR, 'title-subset.woff2'), subset);
writeFileSync(
  resolve(OUT_DIR, 'title-subset.json'),
  `${JSON.stringify({ font: 'Black Han Sans 400 (OFL-1.1), Korean subset', characters, titles }, null, 2)}\n`,
);
// The OFL travels with every copy of the font, modified versions included.
copyFileSync(
  require.resolve('@fontsource/black-han-sans/LICENSE'),
  resolve(OUT_DIR, 'title-subset.OFL.txt'),
);
console.log(`title font: ${characters.length} characters, ${subset.length} bytes`);
