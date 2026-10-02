import type { Locale } from '../constants';
import type { FeatureSupport, GameStatus } from '../enums';

export const GAME_FEATURES = [
  'patches',
  'events',
  'rewards',
  'resets',
  'maintenance',
  'banners',
  'redeemCodes',
] as const;
export type GameFeature = (typeof GAME_FEATURES)[number];

export type GameFeatures = Readonly<Record<GameFeature, FeatureSupport>>;

/** Neutral accent palette keys; mapped to static Tailwind classes in the UI package. */
export const GAME_ACCENTS = ['sky', 'amber', 'orange', 'teal', 'violet', 'rose', 'lime', 'indigo'] as const;
export type GameAccent = (typeof GAME_ACCENTS)[number];

export type LocalizedText = Readonly<Partial<Record<Locale, string>>> & { readonly 'en-US': string };

export interface GameRegion {
  /** Stable region id, e.g. "kr", "asia". */
  id: string;
  name: LocalizedText;
  /** IANA zone or fixed offset ("UTC+8") used for server-time announcements. */
  timezone: string;
  isDefault: boolean;
}

/**
 * Game definition. Configuration, not content: reviewed in code, synced to the `games`
 * table by `pnpm seed`. Never branch on a specific gameId in generic code — add data here.
 */
export interface GameConfig {
  gameId: string;
  /** URL slug; stable once published. */
  slug: string;
  /** Canonical (English) name. Localized names live in `localizedNames`. */
  name: string;
  localizedNames: LocalizedText;
  shortNames: LocalizedText;
  publisher: string;
  developer: string;
  officialUrl: string;
  status: GameStatus;
  /** Default display/server time zone for the primary market region. */
  timezone: string;
  regions: readonly GameRegion[];
  features: GameFeatures;
  /** Source adapter ids able to collect content for this game. */
  adapters: readonly string[];
  accent: GameAccent;
  /** Game-specific words for generic concepts, e.g. Genshin calls banners "기원". */
  terminology: Readonly<{ banner?: LocalizedText; patch?: LocalizedText }>;
  seoKeywords: Readonly<Partial<Record<Locale, readonly string[]>>>;
  /** Shown to anonymous users before MY GAMES is configured. */
  defaultForAnonymous: boolean;
  sortOrder: number;
}
