import { isFeatureAvailable, listPublicGames } from '@gamepulse/domain';
import { expect, test } from '@playwright/test';
import { GAME_IDS } from './helpers';

test.describe('game pages', () => {
  test('game detail shows the overview and navigates between tabs @mobile', async ({ page }) => {
    await page.goto('/games/genshin-impact');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('원신');
    await expect(page.getByTestId('overview-current')).toBeVisible();
    const tabs = page.getByTestId('game-tabs');
    await expect(tabs.getByRole('link', { name: '개요', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await tabs.getByRole('link', { name: '패치', exact: true }).click();
    await expect(page).toHaveURL(/\/games\/genshin-impact\/patches$/);
    await expect(page.getByTestId('patch-list').locator('article').first()).toBeVisible();

    await tabs.getByRole('link', { name: '초기화', exact: true }).click();
    await expect(page).toHaveURL(/\/games\/genshin-impact\/resets$/);
    await expect(page.getByTestId('reset-list').locator('li').first()).toBeVisible();

    await tabs.getByRole('link', { name: '보상', exact: true }).click();
    await expect(page).toHaveURL(/\/games\/genshin-impact\/rewards$/);
    await expect(page.locator('[data-testid^="group-"]').first()).toBeVisible();

    await tabs.getByRole('link', { name: '캘린더', exact: true }).click();
    await expect(page).toHaveURL(/\/games\/genshin-impact\/calendar$/);
    await expect(page.getByTestId('calendar-month')).toBeVisible();
    await expect(
      page.locator('[data-calendar-entry]:not([data-calendar-entry="genshin"])'),
    ).toHaveCount(0);
  });

  test('features a game does not provide are not offered', async ({ page }) => {
    // Any public game without rewards or resets (configuration decides, not a fixed game).
    const game = listPublicGames().find(
      (candidate) =>
        !isFeatureAvailable(candidate, 'rewards') && !isFeatureAvailable(candidate, 'redeemCodes'),
    );
    test.skip(!game, 'every public game currently offers rewards');
    if (!game) return;
    await page.goto(`/games/${game.slug}`);
    const tabs = page.getByTestId('game-tabs');
    await expect(tabs.getByRole('link', { name: '개요', exact: true })).toBeVisible();
    await expect(tabs.getByRole('link', { name: '보상', exact: true })).toHaveCount(0);

    await page.goto(`/games/${game.slug}/rewards`);
    await expect(page.getByText('이 게임은 이 항목을 제공하지 않습니다.')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('games index lists every game', async ({ page }) => {
    await page.goto('/games');
    await expect(page.locator('[data-testid^="game-card-"]')).toHaveCount(GAME_IDS.length);
    await page.getByTestId('game-card-wuwa').getByRole('link').first().click();
    await expect(page).toHaveURL(/\/games\/wuthering-waves$/);
  });

  test('unknown games return 404', async ({ page }) => {
    const response = await page.goto('/games/not-a-game');
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId('not-found')).toBeVisible();
  });
});
