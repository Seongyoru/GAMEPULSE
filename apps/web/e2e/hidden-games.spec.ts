import { expect, test } from '@playwright/test';

/**
 * Lost Ark (and the other PC games) stay registered with fixture content but INACTIVE since
 * GAMEPULSE covers subculture games (D-037): nothing about them may reach a visitor (D-035).
 */
test.describe('hidden (INACTIVE) games', () => {
  test('a prepared game and its content answer 404', async ({ page }) => {
    expect((await page.goto('/games/lost-ark'))?.status()).toBe(404);
    expect((await page.goto('/games/lost-ark/events'))?.status()).toBe(404);
    expect((await page.goto('/events/lost-ark-event-harvest-festival'))?.status()).toBe(404);
    expect((await page.goto('/rewards/lost-ark-code-test-coupon-code'))?.status()).toBe(404);
    expect((await page.goto('/patches/league-of-legends-patch-26-19'))?.status()).toBe(404);
    // The same kind of page for a public game exists, so the 404s above come from hiding.
    expect((await page.goto('/rewards/genshin-impact-code-test-redeem-code'))?.status()).toBe(200);
  });

  test('a prepared game is missing from every listing @mobile', async ({ page }) => {
    await page.goto('/games');
    await expect(page.getByTestId('game-card-genshin')).toBeVisible();
    await expect(page.getByTestId('game-card-lostark')).toHaveCount(0);

    await page.goto('/my-games');
    await expect(page.getByText('원신').first()).toBeVisible();
    await expect(page.getByText('로스트아크')).toHaveCount(0);

    for (const path of ['/', '/today', '/calendar', '/sources']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await expect(
        page.locator('[data-mg-game="lostark"], [data-agenda-entry="lostark"]'),
      ).toHaveCount(0);
      await expect(page.getByText('로스트아크')).toHaveCount(0);
    }
  });
});
