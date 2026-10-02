import { expect, test } from '@playwright/test';

const PRIMARY_LINKS = ['오늘', '게임', '캘린더', '내 게임'];

test.describe('primary navigation', () => {
  test('shows every link in full and marks where the visitor is @mobile', async ({
    page,
    isMobile,
  }) => {
    // The narrowest common phone width: the old header row clipped 내 게임 at 360–390 px.
    if (isMobile) await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/games/lost-ark/events');
    const nav = page.getByRole('navigation', { name: '주요 메뉴' });
    const width = page.viewportSize()?.width ?? 0;
    for (const name of PRIMARY_LINKS) {
      const link = nav.getByRole('link', { name, exact: true });
      await expect(link).toBeInViewport({ ratio: 1 });
      const box = await link.boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    }
    // A game's pages belong to the 게임 section.
    await expect(nav.getByRole('link', { name: '게임', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await nav.getByRole('link', { name: '오늘', exact: true }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(nav.getByRole('link', { name: '오늘', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link', { name: '게임', exact: true })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
