import { test, expect, type Page } from '@playwright/test';

// Authenticated walk through a member's profile editor (courses and CV entries belong to a team
// member since ADR-016; the old /admin/teaching screen is a redirect). Sign in, add a course and a
// CV entry to the director's profile, see them on the public profile page, then delete them.
//
// Credentials are read from the environment and never committed. Set them before running:
//
//   E2E_ADMIN_EMAIL=...  E2E_ADMIN_PASSWORD=...  npm run test:e2e
//
// In CI they come from repository Secrets of the same names. Without them the whole file skips,
// so a contributor with no admin account still gets a green suite rather than a confusing failure.
//
// This spec WRITES to whatever database the app under test is pointed at. It cleans up after
// itself, but the fixture titles below are deliberately unmistakable so a stray row is obvious.
const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

const COURSE_TITLE = 'E2E fixture course - delete me';
const COURSE_LEVEL = 'E2E fixture level';

/** The director's member id: `/teaching` redirects to their public profile, `/team/{id}`. */
async function directorId(page: Page): Promise<string> {
  await page.goto('/teaching');
  await expect(page).toHaveURL(/\/team\/[^/]+$/);
  return new URL(page.url()).pathname.split('/').pop()!;
}

test.describe('Admin member profile editor', () => {
  test.skip(
    !EMAIL || !PASSWORD,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the authenticated specs.',
  );
  // Desktop only: the mobile project covers the public navigation.
  test.skip(({ isMobile }) => isMobile, 'Admin editing is exercised at desktop width.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: false }).fill(EMAIL!);
    await page.getByLabel('Password', { exact: false }).fill(PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Better Auth sets a session cookie and the admin layout's requireAdmin() lets us through.
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
  });

  test('adds a course to the director, shows it publicly, then deletes it', async ({ page }) => {
    const id = await directorId(page);
    await page.goto(`/admin/team/${id}`);

    // --- create -------------------------------------------------------------------------------
    await page.getByRole('button', { name: 'Add course' }).click();
    const form = page.getByRole('dialog', { name: 'Add course' });
    await form.locator('#course-title').fill(COURSE_TITLE);
    await form.locator('#course-level').fill(COURSE_LEVEL);
    await form.locator('#course-term').fill('Autumn 2026');
    await form.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText(COURSE_TITLE)).toBeVisible({ timeout: 15_000 });

    // --- it reaches the public profile --------------------------------------------------------
    await page.goto(`/team/${id}`);
    await expect(page.getByText(COURSE_TITLE)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(COURSE_LEVEL)).toBeVisible();

    // --- delete -------------------------------------------------------------------------------
    await page.goto(`/admin/team/${id}`);
    await page.getByRole('button', { name: `Actions: ${COURSE_TITLE}` }).click();
    await page.getByRole('menuitem', { name: `Delete course: ${COURSE_TITLE}` }).click();

    const confirm = page.getByRole('dialog', { name: 'Delete this course?' });
    await confirm.getByLabel(/to confirm/).fill('delete');
    await confirm.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(COURSE_TITLE)).toBeHidden({ timeout: 15_000 });
  });

  test('rejects a course with no level before it reaches the network', async ({ page }) => {
    const id = await directorId(page);
    await page.goto(`/admin/team/${id}`);

    await page.getByRole('button', { name: 'Add course' }).click();
    const form = page.getByRole('dialog', { name: 'Add course' });
    await form.locator('#course-title').fill('No level given');
    await form.getByRole('button', { name: 'Save changes' }).click();

    // Level is the public grouping key, so the client-side schema blocks the submit and the
    // dialog stays open.
    await expect(form.locator('#course-level')).toHaveAttribute('aria-invalid', 'true');
    await expect(form).toBeVisible();
  });
});
