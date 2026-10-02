'use client';

/**
 * MY GAMES persistence (no account): localStorage behind the domain's PreferencesStore port,
 * so a cloud-synced implementation can replace it later without touching components.
 */
import {
  defaultGameIds,
  defaultPreferences,
  effectiveGameIds,
  sanitizePreferences,
  type PreferencesStore,
  type UserPreferences,
} from '@gamepulse/domain';
import { useSyncExternalStore } from 'react';
import { PREFERENCES_STORAGE_KEY } from './my-games-boot';

/** Stable snapshot used for SSR and hydration (anonymous defaults). */
const SERVER_SNAPSHOT: UserPreferences = defaultPreferences();

class LocalStoragePreferencesStore implements PreferencesStore {
  private cache: UserPreferences | null = null;
  private readonly listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key !== PREFERENCES_STORAGE_KEY) return;
        this.cache = null;
        this.applyToDocument(this.get());
        this.emit();
      });
    }
  }

  get = (): UserPreferences => {
    if (this.cache) return this.cache;
    let stored: unknown = null;
    try {
      const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
      stored = raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      stored = null;
    }
    this.cache = stored === null ? defaultPreferences() : sanitizePreferences(stored);
    return this.cache;
  };

  set = (next: UserPreferences): void => {
    this.cache = sanitizePreferences(next);
    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      // Storage unavailable (private mode / quota): keep the in-memory value for this tab.
    }
    this.applyToDocument(this.cache);
    this.emit();
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  /** Keeps the pre-paint CSS state in sync with the selection. */
  private applyToDocument(preferences: UserPreferences): void {
    const root = document.documentElement;
    if (preferences.selectedGameIds.length > 0)
      root.setAttribute('data-mg', preferences.selectedGameIds.join(' '));
    else root.removeAttribute('data-mg');
  }
}

const serverStore: PreferencesStore = {
  get: () => SERVER_SNAPSHOT,
  set: () => undefined,
  subscribe: () => () => undefined,
};

export const preferencesStore: PreferencesStore =
  typeof window === 'undefined' ? serverStore : new LocalStoragePreferencesStore();

// Stable function identities so useSyncExternalStore never resubscribes.
const subscribe = (listener: () => void) => preferencesStore.subscribe(listener);
const getSnapshot = () => preferencesStore.get();
const getServerSnapshot = () => SERVER_SNAPSHOT;

export function usePreferences(): UserPreferences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function updatePreferences(
  update: (current: UserPreferences) => UserPreferences,
): UserPreferences {
  const next = update(preferencesStore.get());
  preferencesStore.set(next);
  return next;
}

/** Selected games, or the anonymous defaults when nothing is selected. */
export function useEffectiveGameIds(): {
  gameIds: string[];
  configured: boolean;
  preferences: UserPreferences;
} {
  const preferences = usePreferences();
  return {
    gameIds: effectiveGameIds(preferences, defaultGameIds()),
    configured: preferences.selectedGameIds.length > 0,
    preferences,
  };
}

export function toggleGame(gameId: string): { selected: boolean; preferences: UserPreferences } {
  let selected = false;
  const preferences = updatePreferences((current) => {
    selected = !current.selectedGameIds.includes(gameId);
    return {
      ...current,
      selectedGameIds: selected
        ? [...current.selectedGameIds, gameId]
        : current.selectedGameIds.filter((id) => id !== gameId),
      configuredAt: current.configuredAt ?? new Date().toISOString(),
    };
  });
  return { selected, preferences };
}

export function dismissItem(itemId: string): void {
  updatePreferences((current) =>
    current.dismissedPulseIds.includes(itemId)
      ? current
      : { ...current, dismissedPulseIds: [...current.dismissedPulseIds, itemId] },
  );
}

export function restoreDismissed(): void {
  updatePreferences((current) => ({ ...current, dismissedPulseIds: [] }));
}
