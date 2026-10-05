import { test, expect } from '@playwright/test';

// Admin login page (src/app/[locale]/(admin)/login/page.tsx). No seeded database/session is
// required for this spec: it only exercises the React Hook Form + Zod client-side validation
// (src/modules/auth/login.schema.ts) on an empty submit, which never issues a network request —
// Better Auth's `signIn.email` is only called once RHF has validated the fields locally.
test.describe('Admin login page', () => {
  test('shows required-field errors on empty submit without navigating away', async ({ page }) => {
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

// Forgot password (src/app/(admin)/login/forgot-password/page.tsx, ADR-023). Nothing is clicked
// that would send an email: only the first step's content is checked. There is no email field —
// every code goes to the admin mailbox, which the page shows masked and never in full.
test.describe('Forgot password page', () => {
  test('asks for no email address and shows the mailbox masked', async ({ page }) => {
    await page.goto('/login/forgot-password');

    await expect(page.getByRole('heading', { level: 1, name: 'Reset Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reset code' })).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByText(/cu•+@gmail\.com/)).toBeVisible();
    expect(await page.content()).not.toContain('culpritteam@gmail.com');
  });
});
