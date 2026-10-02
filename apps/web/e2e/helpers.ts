import { listPublicGames } from '@gamepulse/domain';
import { expect, type Page } from '@playwright/test';

/** Games the site shows, read from the registry: adding a game needs no E2E edits. */
export const GAME_IDS: readonly string[] = listPublicGames().map((game) => game.gameId);
const PREFERENCES_KEY = 'gamepulse:prefs:v1';

/** Seeds MY GAMES before any page script runs (applies to every navigation of the page). */
export async function presetMyGames(page: Page, gameIds: readonly string[]): Promise<void> {
  await page.addInitScript(
    ({ key, ids }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          selectedGameIds: ids,
          timezone: 'Asia/Seoul',
          locale: 'ko-KR',
          dismissedPulseIds: [],
          configuredAt: '2026-01-01T00:00:00.000Z',
        }),
      );
    },
    { key: PREFERENCES_KEY, ids: gameIds },
  );
}

export async function storedPreferences(
  page: Page,
): Promise<{ selectedGameIds: string[]; dismissedPulseIds: string[] } | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw
      ? (JSON.parse(raw) as { selectedGameIds: string[]; dismissedPulseIds: string[] })
      : null;
  }, PREFERENCES_KEY);
}

/** Visible elements carrying data-mg-game inside a MY GAMES scope, by game. */
export async function visibleGameIds(
  page: Page,
  selector = '[data-mg-scope] [data-mg-game]',
): Promise<string[]> {
  return page
    .locator(selector)
    .evaluateAll((elements) =>
      [
        ...new Set(
          elements
            .filter((element) => (element as HTMLElement).offsetParent !== null)
            .map((element) => element.getAttribute('data-mg-game') ?? ''),
        ),
      ].sort(),
    );
}

/** Waits until React has hydrated the page (client-only state applied). */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toBeVisible();
}
