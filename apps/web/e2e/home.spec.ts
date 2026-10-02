import { expect, test } from '@playwright/test';
import { GAME_IDS } from './helpers';

test.describe('homepage', () => {
  test('opens with the hero, the live pulse and every supported game @mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('All Your Games.');
    await expect(page.getByTestId('sample-banner')).toBeVisible();
    await expect(page.locator('#home-happening')).toBeVisible();
    for (const gameId of GAME_IDS)
      await expect(page.getByTestId(`snapshot-${gameId}`)).toBeVisible();

    await page.getByTestId('hero-choose-games').click();
    await expect(page).toHaveURL(/\/my-games$/);
  });

  test('declares canonical URL, structured data and no-index for sample data', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /^https?:\/\/[^/]+\/?$/,
    );
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(jsonLd ?? 'null')).toMatchObject({ '@type': 'WebSite', name: 'GAMEPULSE' });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toContain('Disallow: /');
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain('<urlset');
  });

  test('unknown pages render the 404 page', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId('not-found')).toBeVisible();
  });
});
