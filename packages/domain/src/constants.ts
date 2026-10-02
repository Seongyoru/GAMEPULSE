/** Product-wide constants. Kept free of any runtime/environment dependency. */

export const PRODUCT_NAME = 'GAMEPULSE';
export const PRODUCT_TAGLINE = 'All Your Games. One Pulse.';

/** Locales the data model and routing are designed for. */
export const SUPPORTED_LOCALES = ['ko-KR', 'en-US', 'ja-JP', 'zh-TW'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Initial market: South Korea. */
export const DEFAULT_LOCALE: Locale = 'ko-KR';
/** Locales with a complete UI message catalog today. */
export const ACTIVE_LOCALES: readonly Locale[] = ['ko-KR'];

export const DEFAULT_TIMEZONE = 'Asia/Seoul';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
