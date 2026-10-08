import { expect, test } from '@playwright/test';
import { GAME_IDS, presetMyGames, visibleGameIds } from './helpers';

test.describe('TODAY', () => {
  test('shows only MY GAMES items @mobile', async ({ page }) => {
    await presetMyGames(page, ['wuwa', 'zzz']);
    await page.goto('/today');
    await expect(page.getByTestId('today-summary')).toContainText('내 게임 소식');
    await expect.poll(() => visibleGameIds(page)).toEqual(['wuwa', 'zzz']);
    await expect(page.getByTestId('snapshot-zzz')).toBeVisible();
    await expect(page.getByTestId('snapshot-genshin')).toHaveCount(0);
  });

  test('covers every default game for anonymous visitors', async ({ page }) => {
    await page.goto('/today');
    await expect(page.getByTestId('today-summary')).toContainText('오늘의 게임 소식');
    await expect.poll(() => visibleGameIds(page)).toEqual([...GAME_IDS].sort());
    await expect(page.getByTestId('today-section-rewards')).toBeVisible();
    await expect(page.getByTestId('today-section-resets')).toBeVisible();
  });

  test('claimed rewards can be hidden and restored', async ({ page }) => {
    await page.goto('/today');
    const rewards = page.getByTestId('today-section-rewards');
    const firstCard = rewards.locator('article').first();
    const href = await firstCard.locator('h3 a').getAttribute('href');
    expect(href).toMatch(/^\/rewards\//);
    const cardLink = rewards.locator(`h3 a[href="${href}"]`);

    await firstCard.getByRole('button').click();
    await expect(cardLink).toHaveCount(0);
    await expect(page.getByText('숨긴 항목 1개')).toBeVisible();

    await page.reload();
    await expect(page.getByText('숨긴 항목 1개')).toBeVisible();
    await expect(cardLink).toHaveCount(0);

    await page.getByRole('button', { name: '다시 보기' }).click();
    await expect(cardLink).toHaveCount(1);
  });
});
