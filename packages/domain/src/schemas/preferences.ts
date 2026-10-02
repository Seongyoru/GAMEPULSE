/**
 * MY GAMES preferences. Stored locally (no account) behind the PreferencesStore port so
 * cloud synchronization can be added later without touching UI code.
 *
 * This module runs in the browser: it is deliberately free of Zod (which would add ~90 KB
 * to every page). The strict schema for server-side/test use is in ./preferences-schema.
 */
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, isSupportedLocale } from '../constants';
import { isGameId } from '../games/registry';
import { isValidTimeZone } from '../time/zone';

export const PREFERENCES_VERSION = 1;
export const MAX_SELECTED_GAMES = 50;
export const MAX_DISMISSED = 500;

export interface UserPreferences {
  version: typeof PREFERENCES_VERSION;
  /** Ordered: the user's ordering is respected on the dashboard. */
  selectedGameIds: string[];
  timezone: string;
  locale: string;
  dismissedPulseIds: string[];
  /** ISO timestamp of the first MY GAMES configuration; null for anonymous defaults. */
  configuredAt: string | null;
}

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value));
}

export function defaultPreferences(): UserPreferences {
  return {
    version: PREFERENCES_VERSION,
    selectedGameIds: [],
    timezone: DEFAULT_TIMEZONE,
    locale: DEFAULT_LOCALE,
    dismissedPulseIds: [],
    configuredAt: null,
  };
}

/**
 * Coerces untrusted stored data (localStorage, future cloud sync) into valid preferences:
 * unknown games are dropped, duplicates removed, invalid zones/locales reset to defaults.
 */
export function sanitizePreferences(input: unknown): UserPreferences {
  const defaults = defaultPreferences();
  if (typeof input !== 'object' || input === null) return defaults;
  const raw = input as Record<string, unknown>;

  const selected = Array.isArray(raw.selectedGameIds)
    ? [...new Set(raw.selectedGameIds.filter((id): id is string => typeof id === 'string'))]
        .filter(isGameId)
        .slice(0, MAX_SELECTED_GAMES)
    : [];
  const timezone =
    typeof raw.timezone === 'string' && isValidTimeZone(raw.timezone)
      ? raw.timezone
      : defaults.timezone;
  const locale =
    typeof raw.locale === 'string' && isSupportedLocale(raw.locale) ? raw.locale : defaults.locale;
  const dismissed = Array.isArray(raw.dismissedPulseIds)
    ? raw.dismissedPulseIds
        .filter((id): id is string => typeof id === 'string')
        .slice(-MAX_DISMISSED)
    : [];

  return {
    version: PREFERENCES_VERSION,
    selectedGameIds: selected,
    timezone,
    locale,
    dismissedPulseIds: dismissed,
    configuredAt: isIsoDateTime(raw.configuredAt) ? raw.configuredAt : null,
  };
}

/** Game ids to display: the user's MY GAMES, or the anonymous defaults. */
export function effectiveGameIds(
  preferences: UserPreferences,
  fallback: readonly string[],
): string[] {
  return preferences.selectedGameIds.length > 0 ? [...preferences.selectedGameIds] : [...fallback];
}

export function hasConfiguredGames(preferences: UserPreferences): boolean {
  return preferences.selectedGameIds.length > 0;
}

/**
 * Port for preference persistence. The web app implements it with localStorage; a future
 * implementation can synchronize with an account without changing consumers.
 */
export interface PreferencesStore {
  get(): UserPreferences;
  set(next: UserPreferences): void;
  subscribe(listener: () => void): () => void;
}
