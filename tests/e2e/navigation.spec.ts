import { test, expect } from '@playwright/test';

// Public navigation, run at desktop and phone width (see playwright.config.ts). Read-only.
//
// Desktop: the header band stays pinned and the sidebar lists the tabs. Phone: the sidebar is gone
// and the header's Menu button opens the same links, with Make Appointment at the foot.

test.describe('Public navigation', () => {
  test('reaches every tab and the appointment page', async ({ page, isMobile }) => {
    // There is no About tab: the site opens on Research.
    await page.goto('/');
    await expect(page).toHaveURL(/\/research$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Research' })).toBeVisible();

    for (const tab of ['Publications', 'Team', 'Events', 'Research']) {
      if (isMobile) {
        await page.getByRole('button', { name: 'Menu' }).click();
        await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: tab }).click();
      } else {
        await page
          .getByRole('navigation', { name: 'Primary' })
          .getByRole('link', { name: tab })
          .click();
      }
      await expect(page.getByRole('heading', { level: 2, name: tab })).toBeVisible();
      if (isMobile) await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
    }

    if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'Make Appointment' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Make Appointment' })).toBeVisible();
  });

  test('keeps the page free of sideways scrolling', async ({ page }) => {
    for (const path of ['/research', '/events', '/team']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    }
  });

  test('pins the header while the page scrolls on desktop', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The header scrolls away with the page below lg.');
    await page.goto('/events');
    await page.mouse.wheel(0, 900);
    const header = page.locator('[data-sticky-header]');
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
  });
});
