import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from '../forgot-password-form';
import { LoginForm } from '../login-form';
import { PasswordConfirmForm } from '../password-confirm-form';
import { TwoFactorChallenge } from '../two-factor-challenge';

// A form submitted before React hydrates falls back to the browser's native submit. With the
// default GET, that puts every named field — the password, an emailed or backup code — in the URL,
// and so in browser history and proxy logs. Every auth form that takes a secret is therefore
// `method="post"`; once hydrated, the submit handler still prevents the native submit.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../auth-client', () => ({
  signIn: { email: vi.fn() },
  twoFactor: { sendOtp: vi.fn(), verifyOtp: vi.fn(), verifyBackupCode: vi.fn() },
  emailOtp: {
    requestPasswordReset: vi.fn(async () => ({ data: { success: true }, error: null })),
    resetPassword: vi.fn(),
  },
}));

const MASKED = 'cu•••••••••@gmail.com';
// Under jsdom `import.meta.url` isn't a file URL; this file sits in ui/__tests__/.
const UI_DIR = path.resolve(__dirname, '..');

/** The form a secret field belongs to, checked to submit by POST and to stay client-side. */
async function expectPostOnly(field: HTMLElement) {
  const form = field.closest('form');
  expect(form).not.toBeNull();
  expect(form).toHaveAttribute('method', 'post');
  // The field is named, so a native submit would carry it — in the body, never the URL.
  expect(field).toHaveAttribute('name');
  // Hydrated: the handler cancels the native submit (fireEvent returns false when prevented).
  let notPrevented = true;
  await act(async () => {
    notPrevented = fireEvent.submit(form!);
  });
  expect(notPrevented).toBe(false);
}

describe('auth forms never submit secrets by GET', () => {
  it('the sign-in form', async () => {
    render(<LoginForm maskedEmail={MASKED} />);
    await expectPostOnly(screen.getByLabelText('Password', { exact: false }));
  });

  it('the emailed-code and backup-code forms', async () => {
    const user = userEvent.setup();
    render(
      <TwoFactorChallenge
        maskedEmail={MASKED}
        initialSendError={null}
        onVerified={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    await expectPostOnly(screen.getByLabelText('Verification code', { exact: false }));

    await user.click(screen.getByRole('button', { name: 'Use a backup code instead' }));
    await expectPostOnly(screen.getByLabelText(/^Backup code/));
  });

  it('both steps of the password reset', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm maskedEmail={MASKED} />);
    const send = screen.getByRole('button', { name: 'Send reset code' });
    expect(send.closest('form')).toHaveAttribute('method', 'post');

    await user.click(send);
    await expectPostOnly(await screen.findByLabelText('Verification code', { exact: false }));
    await expectPostOnly(screen.getByLabelText(/^New password/));
    await expectPostOnly(screen.getByLabelText(/^Confirm new password/));
  });

  it('the password confirmation before generating backup codes', async () => {
    render(
      <PasswordConfirmForm
        id="confirm-password"
        submitLabel="Generate codes"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await expectPostOnly(screen.getByLabelText(/^Current password/));
  });

  it('every <form> in the auth UI declares method="post"', () => {
    const files = readdirSync(UI_DIR).filter((name) => name.endsWith('.tsx'));
    let forms = 0;
    for (const name of files) {
      const source = readFileSync(path.join(UI_DIR, name), 'utf8');
      for (const [tag] of source.matchAll(/<form\b[^>]*>/g)) {
        forms++;
        expect(tag, name).toMatch(/\bmethod="post"/);
      }
    }
    // Guards the scan itself: the six forms above are all found.
    expect(forms).toBeGreaterThanOrEqual(6);
  });
});
