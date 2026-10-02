import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MY_GAMES_BOOT_SCRIPT, myGamesCss, PREFERENCES_STORAGE_KEY } from './my-games-boot';
import {
  dismissItem,
  preferencesStore,
  restoreDismissed,
  toggleGame,
  usePreferences,
} from './preferences';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function runBootScript(): void {
  // Executes the exact IIFE string the root layout inlines into <head>.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- testing the shipped inline script
  const boot = new Function(MY_GAMES_BOOT_SCRIPT) as () => void;
  boot();
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-mg');
  // Reset the store's cached state between tests.
  preferencesStore.set({
    ...preferencesStore.get(),
    selectedGameIds: [],
    dismissedPulseIds: [],
    configuredAt: null,
  });
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-mg');
});

afterEach(() => {
  window.localStorage.clear();
});

describe('MY GAMES boot script', () => {
  it('copies valid stored game ids onto <html data-mg> before hydration', () => {
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ selectedGameIds: ['lostark', 'genshin', 'x"]{}<script>', 42] }),
    );
    runBootScript();
    expect(document.documentElement.getAttribute('data-mg')).toBe('lostark genshin');
  });

  it('only lets ids of games shown on the site reach the attribute', () => {
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ selectedGameIds: ['retired-game', 'not-a-game'] }),
    );
    runBootScript();
    // A selection of hidden or unknown games must not hide every card before hydration.
    expect(document.documentElement.hasAttribute('data-mg')).toBe(false);
  });

  it('ignores corrupted storage without throwing', () => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, '{not json');
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.hasAttribute('data-mg')).toBe(false);
  });

  it('generates one hiding rule per game, scoped to MY GAMES containers', () => {
    const css = myGamesCss();
    expect(css).toContain(
      'html[data-mg]:not([data-mg~="lol"]) [data-mg-scope] [data-mg-game="lol"]{display:none!important}',
    );
    expect(css.match(/display:none/g)).toHaveLength(5);
  });
});

describe('preferences store', () => {
  it('persists toggles and keeps <html data-mg> in sync', () => {
    expect(toggleGame('wuwa').selected).toBe(true);
    expect(toggleGame('maplestory').selected).toBe(true);
    const stored = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? 'null') as {
      selectedGameIds: string[];
      configuredAt: string | null;
    };
    expect(stored.selectedGameIds).toEqual(['wuwa', 'maplestory']);
    expect(stored.configuredAt).not.toBeNull();
    expect(document.documentElement.getAttribute('data-mg')).toBe('wuwa maplestory');

    expect(toggleGame('wuwa').selected).toBe(false);
    expect(toggleGame('maplestory').selected).toBe(false);
    expect(document.documentElement.hasAttribute('data-mg')).toBe(false);
  });

  it('dismisses and restores items', () => {
    dismissItem('item-1');
    dismissItem('item-1');
    expect(preferencesStore.get().dismissedPulseIds).toEqual(['item-1']);
    restoreDismissed();
    expect(preferencesStore.get().dismissedPulseIds).toEqual([]);
  });

  it('re-renders subscribed components when preferences change', () => {
    const seen: string[][] = [];
    function Probe() {
      const { selectedGameIds } = usePreferences();
      useEffect(() => {
        seen.push(selectedGameIds);
      }, [selectedGameIds]);
      return <span>{selectedGameIds.join(',')}</span>;
    }
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<Probe />));
    act(() => {
      toggleGame('lol');
    });
    expect(container.textContent).toBe('lol');
    expect(seen.at(-1)).toEqual(['lol']);
    act(() => root.unmount());
  });
});
