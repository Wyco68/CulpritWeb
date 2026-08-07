import { test, expect } from '@playwright/test';

// Admin login page (src/app/[locale]/(admin)/login/page.tsx). No seeded database/session is
// required for this spec: it only exercises the React Hook Form + Zod client-side validation
// (src/modules/auth/login.schema.ts) on an empty submit, which never issues a network request —
// Better Auth's `signIn.email` is only called once RHF has validated the fields locally.
test.describe('Admin login page', () => {
  test('shows required-field errors on empty submit without navigating away', async ({
    page,
  }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign in' }).click();

    const emailInput = page.getByLabel('Email', { exact: false });
    const passwordInput = page.getByLabel('Password', { exact: false });

    await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    await expect(passwordInput).toHaveAttribute('aria-invalid', 'true');

    // Still on the login page — invalid client-side submission never reached Better Auth.
    await expect(page).toHaveURL(/\/login$/);
  });
});
