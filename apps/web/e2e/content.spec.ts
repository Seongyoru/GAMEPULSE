import { expect, test } from '@playwright/test';

test.describe('content detail', () => {
  test('event detail shows facts, the official source and structured data @mobile', async ({
    page,
  }) => {
    await page.goto('/games/genshin-impact/events');
    const firstCard = page.locator('[data-testid^="group-"] article').first();
    const title = (await firstCard.locator('h3').innerText()).trim();
    await firstCard.locator('h3 a').click();

    await expect(page).toHaveURL(/\/events\/genshin-impact-/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByRole('navigation', { name: 'breadcrumb' })).toContainText('원신');

    const source = page.locator('a[data-source-link]').first();
    await expect(source).toHaveAttribute(
      'href',
      /^https:\/\/([a-z0-9-]+\.)*(hoyoverse|hoyolab)\.com\//,
    );
    await expect(source).toHaveAttribute('rel', /noopener/);

    const types = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts): string[] =>
        scripts
          .flatMap((script) => [JSON.parse(script.textContent ?? 'null') as unknown].flat())
          .map((data) => (data as { '@type': string })['@type']),
      );
    expect(types).toContain('BreadcrumbList');
    expect(types.some((type) => type === 'Event' || type === 'Article')).toBe(true);
  });

  test('patch detail lists structured changes', async ({ page }) => {
    await page.goto('/patches/league-of-legends-patch-26-19');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('26.19 패치');
    await expect(page.locator('#patch-changes')).toContainText('변경 사항');
    await expect(page.getByText('아리', { exact: true })).toBeVisible();
  });

  test('synthetic redeem codes are flagged and cannot be copied', async ({ page }) => {
    await page.goto('/rewards/genshin-impact-code-test-redeem-code');
    await expect(page.getByTestId('redeem-code')).toContainText('GPTEST-');
    await expect(page.getByTestId('synthetic-code-warning')).toBeVisible();
    await expect(page.getByRole('button', { name: '복사' })).toHaveCount(0);
  });

  test('content in the wrong URL family redirects to its canonical URL', async ({ page }) => {
    await page.goto('/events/league-of-legends-patch-26-19');
    await expect(page).toHaveURL(/\/patches\/league-of-legends-patch-26-19$/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/patches\/league-of-legends-patch-26-19$/,
    );
  });

  test('unknown or malformed slugs return 404', async ({ page }) => {
    expect((await page.goto('/events/no-such-event'))?.status()).toBe(404);
    expect((await page.goto('/events/%3Cscript%3E'))?.status()).toBe(404);
  });
});
