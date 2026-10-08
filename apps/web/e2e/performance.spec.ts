import { expect, test, type Page } from '@playwright/test';
import { presetMyGames } from './helpers';

/**
 * Core Web Vitals budgets measured in the browser on the production build:
 * LCP < 2.5 s and CLS < 0.1 (docs/SEO.md). Personalized pages must not shift layout when
 * MY GAMES is applied, so TODAY is also measured with a stored selection.
 */
interface Vitals {
  cls: number;
  lcp: number;
}

async function observeVitals(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const vitals = { cls: 0, lcp: 0 };
    (window as unknown as { __vitals: typeof vitals }).__vitals = vitals;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >) {
        if (!entry.hadRecentInput) vitals.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) vitals.lcp = last.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
}

async function readVitals(page: Page): Promise<Vitals> {
  // Let late shifts (hydration, fonts, client-side personalization) surface before reading.
  await page.waitForTimeout(800);
  return page.evaluate(() => (window as unknown as { __vitals: Vitals }).__vitals);
}

const PAGES = [
  '/',
  '/today',
  '/games/genshin-impact',
  '/calendar',
  '/patches/genshin-impact-patch-7-1',
];

test.describe('performance budgets', () => {
  for (const path of PAGES) {
    test(`${path} stays within LCP and CLS budgets @mobile`, async ({ page }) => {
      await observeVitals(page);
      await page.goto(path, { waitUntil: 'networkidle' });
      const vitals = await readVitals(page);
      expect(vitals.cls, 'CLS').toBeLessThan(0.1);
      expect(vitals.lcp, 'LCP (ms)').toBeGreaterThan(0);
      expect(vitals.lcp, 'LCP (ms)').toBeLessThan(2500);
    });
  }

  test('personalized TODAY does not shift layout @mobile', async ({ page }) => {
    await presetMyGames(page, ['genshin', 'zzz']);
    await observeVitals(page);
    await page.goto('/today', { waitUntil: 'networkidle' });
    const vitals = await readVitals(page);
    expect(vitals.cls, 'CLS').toBeLessThan(0.1);
  });
});
