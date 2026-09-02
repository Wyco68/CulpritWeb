import { test, expect } from '@playwright/test';

// Authenticated walk through the admin Teaching screen: sign in, add a course, see it appear on
// the public tab, then delete it.
//
// Credentials are read from the environment and never committed. Set them before running:
//
//   E2E_ADMIN_EMAIL=...  E2E_ADMIN_PASSWORD=...  npm run test:e2e
//
// In CI they come from repository Secrets of the same names. Without them the whole file skips,
// so a contributor with no admin account still gets a green suite rather than a confusing failure.
//
// This spec WRITES to whatever database the app under test is pointed at. It cleans up after
// itself, but the fixture title below is deliberately unmistakable so a stray row is obvious.
const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

const COURSE_TITLE = 'E2E fixture — delete me';
const COURSE_LEVEL = 'E2E fixture level';

test.describe('Admin teaching screen', () => {
  test.skip(
    !EMAIL || !PASSWORD,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the authenticated specs.',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: false }).fill(EMAIL!);
    await page.getByLabel('Password', { exact: false }).fill(PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Better Auth sets a session cookie and the admin layout's requireAdmin() lets us through.
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
  });

  test('creates a course, publishes it to the public tab, then deletes it', async ({ page }) => {
    await page.goto('/admin/teaching');
    await expect(page.getByRole('heading', { name: 'Teaching', level: 1 })).toBeVisible();

    // --- create -------------------------------------------------------------------------------
    await page.getByRole('button', { name: 'Add course' }).click();
    await page.locator('#course-title').fill(COURSE_TITLE);
    await page.locator('#course-level').fill(COURSE_LEVEL);
    await page.locator('#course-term').fill('Autumn 2026');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText(COURSE_TITLE)).toBeVisible({ timeout: 15_000 });

    // --- it reaches the public tab ------------------------------------------------------------
    // The admin write calls revalidatePath for the `teaching` area, so the prerendered page is
    // rebuilt rather than served stale.
    await page.goto('/teaching');
    await expect(page.getByText(COURSE_TITLE)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(COURSE_LEVEL)).toBeVisible();

    // --- delete -------------------------------------------------------------------------------
    await page.goto('/admin/teaching');
    await page.getByRole('button', { name: `Delete course: ${COURSE_TITLE}` }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Delete this course?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(COURSE_TITLE)).toBeHidden({ timeout: 15_000 });
  });

  test('adds a CV entry to a chosen section and removes it again', async ({ page }) => {
    const entryTitle = 'E2E fixture entry — delete me';

    await page.goto('/admin/teaching');

    await page.getByRole('button', { name: 'Add entry' }).click();
    await page.locator('#cv-section').selectOption('teaching_role');
    await page.locator('#cv-title').fill(entryTitle);
    // Free text on purpose — a range must survive the round trip unchanged.
    await page.locator('#cv-year').fill('2019–2023');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText(entryTitle)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('2019–2023')).toBeVisible();

    await page.goto('/teaching');
    await expect(page.getByText(entryTitle)).toBeVisible({ timeout: 15_000 });

    await page.goto('/admin/teaching');
    await page.getByRole('button', { name: `Delete entry: ${entryTitle}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(entryTitle)).toBeHidden({ timeout: 15_000 });
  });

  test('rejects a course with no level before it reaches the network', async ({ page }) => {
    await page.goto('/admin/teaching');

    await page.getByRole('button', { name: 'Add course' }).click();
    await page.locator('#course-title').fill('No level given');
    await page.getByRole('button', { name: 'Save changes' }).click();

    // Level is the public grouping key, so the client-side schema blocks the submit and the
    // dialog stays open.
    await expect(page.locator('#course-level')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
