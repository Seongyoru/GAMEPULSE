import { expect, test } from '@playwright/test';
import { storedPreferences } from './helpers';

test.describe('MY GAMES', () => {
  test('user selects games and the selection persists across reloads and pages @mobile', async ({
    page,
  }) => {
    await page.goto('/my-games');
    const status = page.getByTestId('my-games-status');
    await expect(status).toContainText('선택하지 않으면');

    const zzz = page.locator('[data-game-toggle="zzz"]');
    const genshin = page.locator('[data-game-toggle="genshin"]');
    await zzz.click();
    await genshin.click();
    await expect(zzz).toHaveAttribute('aria-pressed', 'true');
    await expect(genshin).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-game-toggle="wuwa"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(status).toHaveText('2개 선택됨');
    await expect(page.getByTestId('nav-my-games')).toContainText('2');
    expect((await storedPreferences(page))?.selectedGameIds).toEqual(['zzz', 'genshin']);

    await page.reload();
    await expect(page.locator('[data-game-toggle="zzz"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('my-games-status')).toHaveText('2개 선택됨');

    await page.goto('/today');
    await expect(page.getByTestId('snapshot-zzz')).toBeVisible();
    await expect(page.getByTestId('snapshot-genshin')).toBeVisible();
    await expect(page.getByTestId('snapshot-wuwa')).toHaveCount(0);
    await expect(page.getByTestId('today-summary')).toContainText('내 게임 소식');

    await page.goto('/my-games');
    await page.locator('[data-game-toggle="zzz"]').click();
    await expect(page.getByTestId('my-games-status')).toHaveText('1개 선택됨');
    expect((await storedPreferences(page))?.selectedGameIds).toEqual(['genshin']);
  });

  test('a game page adds the game to MY GAMES', async ({ page }) => {
    await page.goto('/games/wuthering-waves');
    const toggle = page.getByTestId('my-games-toggle').first();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('nav-my-games')).toContainText('1');
    expect((await storedPreferences(page))?.selectedGameIds).toEqual(['wuwa']);
  });

  test('corrupted stored preferences fall back to defaults', async ({ page }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem('gamepulse:prefs:v1', '{"selectedGameIds":["not-a-game",42]'),
    );
    await page.goto('/my-games');
    await expect(page.getByTestId('my-games-status')).toContainText('선택하지 않으면');
  });
});
