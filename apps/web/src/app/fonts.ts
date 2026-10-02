import localFont from 'next/font/local';

/**
 * Display face for the wordmark, English headlines and numbers (Space Grotesk, OFL-1.1).
 * Self-hosted from the npm package: no request to a font CDN, and next/font sizes the
 * fallback so swapping fonts does not shift the layout.
 */
export const displayFont = localFont({
  src: '../../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2',
  variable: '--font-space-grotesk',
  weight: '300 700',
  display: 'swap',
});

/**
 * Title face for game title cards and marks: Black Han Sans (OFL-1.1) cut down to the characters
 * of the game names (`pnpm fonts:titles`, scripts/subset-title-font.ts) — about 6 KB.
 */
export const titleFont = localFont({
  src: './fonts/title-subset.woff2',
  variable: '--font-black-han-sans',
  weight: '400',
  display: 'swap',
});
