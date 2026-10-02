import { expect, test } from '@playwright/test';
import { GAME_IDS } from './helpers';

test.describe('game pages', () => {
  test('game detail shows the overview and navigates between tabs @mobile', async ({ page }) => {
    await page.goto('/games/lost-ark');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('로스트아크');
    await expect(page.getByTestId('overview-current')).toBeVisible();
    const tabs = page.getByTestId('game-tabs');
    await expect(tabs.getByRole('link', { name: '개요', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await tabs.getByRole('link', { name: '패치', exact: true }).click();
    await expect(page).toHaveURL(/\/games\/lost-ark\/patches$/);
    await expect(page.getByTestId('patch-list').locator('article').first()).toBeVisible();

    await tabs.getByRole('link', { name: '초기화', exact: true }).click();
    await expect(page).toHaveURL(/\/games\/lost-ark\/resets$/);
    await expect(page.getByTestId('reset-list').locator('li').first()).toBeVisible();

    await tabs.getByRole('link', { name: '보상', exact: true }).click();
    await expect(page).toHaveURL(/\/games\/lost-ark\/rewards$/);
    await expect(page.locator('[data-testid^="group-"]').first()).toBeVisible();

    await tabs.getByRole('link', { name: '캘린더', exact: true }).click();
    await expect(page).toHaveURL(/\/games\/lost-ark\/calendar$/);
    await expect(page.getByTestId('calendar-month')).toBeVisible();
    await expect(
      page.locator('[data-calendar-entry]:not([data-calendar-entry="lostark"])'),
    ).toHaveCount(0);
  });

  test('features a game does not provide are not offered', async ({ page }) => {
    await page.goto('/games/league-of-legends');
    const tabs = page.getByTestId('game-tabs');
    await expect(tabs.getByRole('link', { name: '패치', exact: true })).toBeVisible();
    await expect(tabs.getByRole('link', { name: '보상', exact: true })).toHaveCount(0);
    await expect(tabs.getByRole('link', { name: '초기화', exact: true })).toHaveCount(0);

    await page.goto('/games/league-of-legends/rewards');
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
