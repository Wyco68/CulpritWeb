import { existsSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

// A signed-in admin for the authenticated specs, without weakening sign-in for tests.
//
// Every admin sign-in ends with an 8-digit code emailed to the admin mailbox (ADR-023). A spec
// can't complete that step on its own: the mailbox is a real inbox, the server keeps only a keyed
// hash of the code, and the dev server Playwright talks to is usually the developer's own
// (`reuseExistingServer`), whose log the test can't read. So the authenticated specs reuse a
// session that a person signed in to once, saved with Playwright's storage state:
//
//   1. With the dev server running, open a recording browser that saves its cookies on close:
//        npx playwright codegen --save-storage=tests/e2e/.auth/admin.json http://localhost:3000/login
//   2. Sign in there — password, then the code from the mailbox — and close the window.
//   3. Run the specs against it:
//        E2E_ADMIN_STORAGE_STATE=tests/e2e/.auth/admin.json npm run test:e2e
//
// The file holds a live admin session cookie for the shared database: `tests/e2e/.auth/` is
// gitignored; delete the file when done. A session lasts 7 days (renewed daily while used), and a
// password reset signs every session out, so record it again when the specs report it expired.
// Without the variable (or the file) the authenticated specs skip.

/** Path to the saved storage state, from E2E_ADMIN_STORAGE_STATE. */
const STORAGE_STATE_PATH = process.env.E2E_ADMIN_STORAGE_STATE;

/** The saved session to load, or undefined when there is none — pass to `test.use`. */
export const adminStorageState =
  STORAGE_STATE_PATH && existsSync(STORAGE_STATE_PATH) ? STORAGE_STATE_PATH : undefined;

/** For `test.skip(...)`: why an authenticated spec can't run, or null when it can. */
export const adminSessionSkipReason: string | null = !STORAGE_STATE_PATH
  ? 'Set E2E_ADMIN_STORAGE_STATE to a saved admin session (see tests/e2e/support/admin-session.ts).'
  : !adminStorageState
    ? `No saved admin session at ${STORAGE_STATE_PATH} (see tests/e2e/support/admin-session.ts).`
    : null;

/**
 * Opens the dashboard and fails with a clear message when the saved session no longer works: the
 * admin layout redirects a request without a live session to /login.
 */
export async function expectAdminSession(page: Page): Promise<void> {
  await page.goto('/admin');
  await expect(
    page,
    'The saved admin session has expired or was signed out. Record it again (see tests/e2e/support/admin-session.ts).',
  ).toHaveURL(/\/admin(\/|$)/, { timeout: 15_000 });
}
