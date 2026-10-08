import { expect, test } from '@playwright/test';

test.describe('policies, sources and health', () => {
  test('footer links reach the data sources, terms and privacy pages @mobile', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('navigation', { name: 'footer' });

    await footer.getByRole('link', { name: '데이터 출처' }).click();
    await expect(page).toHaveURL(/\/sources$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('데이터 출처');
    await expect(page.locator('main')).toContainText('원신');
    // Sources of hidden games are not listed.
    await expect(page.getByText('Data based on NEXON Open API')).toHaveCount(0);

    await page
      .getByRole('navigation', { name: 'footer' })
      .getByRole('link', { name: '이용약관' })
      .click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('이용약관');
    // Riot's notice is shown only while a Riot game is listed.
    await expect(page.getByText("isn't endorsed by Riot Games")).toHaveCount(0);

    await page
      .getByRole('navigation', { name: 'footer' })
      .getByRole('link', { name: '개인정보 처리방침' })
      .click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.locator('main code')).toHaveText('gamepulse:prefs:v1');
  });

  test('health endpoint reports data freshness without caching', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    const body = (await response.json()) as {
      status: string;
      dataSource: string;
      lastUpdatedAt: string | null;
    };
    expect(body).toMatchObject({ status: 'ok', dataSource: 'fixtures' });
    expect(body.lastUpdatedAt).not.toBeNull();
  });

  test('security headers are sent', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['x-powered-by']).toBeUndefined();
  });
});
