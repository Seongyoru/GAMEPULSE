import { expect, test } from '@playwright/test';

function currentKstMonth(offset = 0): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value) + offset;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

test.describe('calendar', () => {
  test('shows the current month and filters by game @mobile', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByTestId('calendar-month')).toHaveText(currentKstMonth());

    // Weekly resets guarantee entries for these games in every month.
    await expect(page.locator('[data-agenda-entry="genshin"]').first()).toBeVisible();
    await expect(page.locator('[data-agenda-entry="wuwa"]').first()).toBeVisible();

    const genshin = page.locator('[data-game-toggle="genshin"]');
    await expect(genshin).toHaveAttribute('aria-pressed', 'true');
    await genshin.click();
    await expect(genshin).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-agenda-entry="genshin"]')).toHaveCount(0);
    await expect(page.locator('[data-calendar-entry="genshin"]')).toHaveCount(0);
    await expect(page.locator('[data-agenda-entry="wuwa"]').first()).toBeVisible();

    await genshin.click();
    await expect(page.locator('[data-agenda-entry="genshin"]').first()).toBeVisible();
  });

  test('navigates between months', async ({ page }) => {
    await page.goto('/calendar');
    const caption = page.getByTestId('calendar-month');
    await expect(caption).toHaveText(currentKstMonth());
    await page.getByRole('button', { name: /다음 달/ }).click();
    await expect(caption).toHaveText(currentKstMonth(1));
    await expect(page.getByRole('button', { name: /다음 달/ })).toBeDisabled();
    await page.getByRole('button', { name: '이번 달' }).click();
    await expect(caption).toHaveText(currentKstMonth());
    await page.getByRole('button', { name: /이전 달/ }).click();
    await expect(caption).toHaveText(currentKstMonth(-1));
  });
});
