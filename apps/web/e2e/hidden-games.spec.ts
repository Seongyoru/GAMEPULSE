import { expect, test } from '@playwright/test';

/**
 * Zenless Zone Zero is registered with fixture content but INACTIVE (prepared ahead of launch):
 * nothing about it may reach a visitor until its status switches to ACTIVE (D-035).
 */
test.describe('hidden (INACTIVE) games', () => {
  test('a prepared game and its content answer 404', async ({ page }) => {
    expect((await page.goto('/games/zenless-zone-zero'))?.status()).toBe(404);
    expect((await page.goto('/games/zenless-zone-zero/events'))?.status()).toBe(404);
    expect((await page.goto('/events/zenless-zone-zero-event-night-patrol'))?.status()).toBe(404);
    expect((await page.goto('/rewards/zenless-zone-zero-code-test-redeem-code'))?.status()).toBe(
      404,
    );
    // The same kind of page for a public game exists, so the 404s above come from hiding.
    expect((await page.goto('/rewards/genshin-impact-code-test-redeem-code'))?.status()).toBe(200);
  });

  test('a prepared game is missing from every listing @mobile', async ({ page }) => {
    await page.goto('/games');
    await expect(page.getByTestId('game-card-genshin')).toBeVisible();
    await expect(page.getByTestId('game-card-zzz')).toHaveCount(0);

    await page.goto('/my-games');
    await expect(page.getByText('원신').first()).toBeVisible();
    await expect(page.getByText('젠레스 존 제로')).toHaveCount(0);

    for (const path of ['/', '/today', '/calendar', '/sources']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('[data-mg-game="zzz"], [data-agenda-entry="zzz"]')).toHaveCount(0);
      await expect(page.getByText('젠레스 존 제로')).toHaveCount(0);
    }
  });
});
