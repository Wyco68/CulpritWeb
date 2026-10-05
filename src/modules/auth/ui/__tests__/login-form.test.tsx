import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../login-form';

const MASKED = 'cu•••••••••@gmail.com';

const pushMock = vi.fn();
const refreshMock = vi.fn();
const signInEmailMock = vi.fn();
const sendOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const verifyBackupCodeMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderForm() {
  return render(<LoginForm maskedEmail={MASKED} />);
}

vi.mock('../../auth-client', () => ({
  signIn: { email: (...args: unknown[]) => signInEmailMock(...args) },
  twoFactor: {
    sendOtp: (...args: unknown[]) => sendOtpMock(...args),
    verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
    verifyBackupCode: (...args: unknown[]) => verifyBackupCodeMock(...args),
  },
}));

const ok = <T,>(data: T) => ({ data, error: null });
const fail = (status: number, code?: string) => ({
  data: null,
  error: { status, code, message: 'raw server text' },
});

async function submitPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email', { exact: false }), 'admin@example.com');
  await user.type(screen.getByLabelText('Password', { exact: false }), 'correct-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    signInEmailMock.mockReset();
    sendOtpMock.mockReset();
    verifyOtpMock.mockReset();
    verifyBackupCodeMock.mockReset();
  });

  it('shows validation errors and never calls signIn for an empty submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(signInEmailMock).not.toHaveBeenCalled();
  });

  it('wires the email input to its label and validates format', async () => {
    const user = userEvent.setup();
    renderForm();

    const email = screen.getByLabelText('Email', { exact: false });
    await user.type(email, 'not-an-email');
    await user.type(screen.getByLabelText('Password', { exact: false }), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(signInEmailMock).not.toHaveBeenCalled();
  });

  it('links to the forgot-password page', () => {
    renderForm();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/login/forgot-password',
    );
  });

  it.each([
    ['a session', { redirect: false, token: 't', user: {} }],
    ['twoFactorRedirect: false', { twoFactorRedirect: false }],
  ])('never signs in on a password alone: %s is shown as a failure', async (_label, data) => {
    signInEmailMock.mockResolvedValue(ok(data));
    const user = userEvent.setup();
    renderForm();

    await submitPassword(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Sign-in couldn't be completed. Please try again.",
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(sendOtpMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('maps a failed automatic enrolment to a generic retry', async () => {
    signInEmailMock.mockResolvedValue(fail(500, 'TWO_FACTOR_SETUP_FAILED'));
    const user = userEvent.setup();
    renderForm();

    await submitPassword(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Sign-in couldn't be completed. Please try again.");
    expect(alert).not.toHaveTextContent('raw server text');
    expect(sendOtpMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('maps a wrong password to friendly copy without redirecting', async () => {
    signInEmailMock.mockResolvedValue(fail(401, 'INVALID_EMAIL_OR_PASSWORD'));
    const user = userEvent.setup();
    renderForm();

    await submitPassword(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That email and password combination is incorrect.');
    expect(alert).not.toHaveTextContent('raw server text');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('reports the rate limit when the middleware answers 429 without a code', async () => {
    signInEmailMock.mockResolvedValue(fail(429));
    const user = userEvent.setup();
    renderForm();

    await submitPassword(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Please try again in a few minutes.',
    );
  });

  describe('the code step, after every correct password', () => {
    beforeEach(() => {
      signInEmailMock.mockResolvedValue(ok({ twoFactorRedirect: true, twoFactorMethods: ['otp'] }));
      sendOtpMock.mockResolvedValue(ok({ status: true }));
    });

    it('sends one code and moves to the code step in place, focused on the code field', async () => {
      const user = userEvent.setup();
      renderForm();

      await submitPassword(user);

      expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
      const code = screen.getByLabelText('Verification code', { exact: false });
      await waitFor(() => expect(code).toHaveFocus());
      expect(code).toHaveAttribute('autocomplete', 'one-time-code');
      expect(code).toHaveAttribute('inputmode', 'numeric');
      expect(code).toHaveAccessibleDescription(
        `We sent an 8-digit code to ${MASKED}. It expires 5 minutes after it was sent.`,
      );
      expect(sendOtpMock).toHaveBeenCalledTimes(1);
      expect(pushMock).not.toHaveBeenCalled();
      // The resend waits out its cooldown after the first send.
      expect(screen.getByRole('button', { name: /Resend code/ })).toBeDisabled();
    });

    it('verifies the code (spaces dropped) and redirects to /admin', async () => {
      verifyOtpMock.mockResolvedValue(ok({ token: 't', user: {} }));
      const user = userEvent.setup();
      renderForm();
      await submitPassword(user);

      await user.type(
        await screen.findByLabelText('Verification code', { exact: false }),
        '1234 5678',
      );
      await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin'));
      expect(verifyOtpMock).toHaveBeenCalledWith({ code: '12345678' });
      expect(refreshMock).toHaveBeenCalled();
    });

    it('validates the code locally before spending an attempt', async () => {
      const user = userEvent.setup();
      renderForm();
      await submitPassword(user);

      await user.type(await screen.findByLabelText('Verification code', { exact: false }), '123');
      await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));

      expect(await screen.findByText('Enter the 8-digit code from the email.')).toBeInTheDocument();
      expect(verifyOtpMock).not.toHaveBeenCalled();
    });

    it('shows a wrong code as friendly copy and stays on the code step', async () => {
      verifyOtpMock.mockResolvedValue(fail(401, 'INVALID_CODE'));
      const user = userEvent.setup();
      renderForm();
      await submitPassword(user);

      const code = await screen.findByLabelText('Verification code', { exact: false });
      await user.type(code, '12345678');
      await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));

      expect(await screen.findByRole('alert')).toHaveTextContent("That code isn't right.");
      expect(code).toHaveValue('');
      expect(code).toHaveFocus();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('returns to the password step with a message when the challenge has expired', async () => {
      verifyOtpMock.mockResolvedValue(fail(401, 'INVALID_TWO_FACTOR_COOKIE'));
      const user = userEvent.setup();
      renderForm();
      await submitPassword(user);

      await user.type(
        await screen.findByLabelText('Verification code', { exact: false }),
        '12345678',
      );
      await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Enter your password again.');
      const password = screen.getByLabelText('Password', { exact: false });
      await waitFor(() => expect(password).toHaveFocus());
      expect(password).toHaveValue('');
      expect(screen.getByLabelText('Email', { exact: false })).toHaveValue('admin@example.com');
    });

    it('reports the account lock specifically', async () => {
      verifyOtpMock.mockResolvedValue(fail(429, 'ACCOUNT_TEMPORARILY_LOCKED'));
      const user = userEvent.setup();
      renderForm();
      await submitPassword(user);

      await user.type(
        await screen.findByLabelText('Verification code', { exact: false }),
        '12345678',
      );
      await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/locked for 15 minutes/);
    });

    it('still opens the code step when the first send fails, with the reason', async () => {
      sendOtpMock.mockResolvedValue(fail(503, 'EMAIL_DELIVERY_FAILED'));
      const user = userEvent.setup();
      renderForm();
      await submitPassword(user);

      expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't send the code.");
      // No cooldown after a failed send: resending is available straight away.
      expect(screen.getByRole('button', { name: /Resend code/ })).toBeEnabled();
    });

    it('resends a code and says where it went, masked', async () => {
      sendOtpMock
        .mockResolvedValueOnce(fail(503, 'EMAIL_DELIVERY_FAILED'))
        .mockResolvedValueOnce(ok({ status: true }));
      const user = userEvent.setup();
      renderForm();
      await submitPassword(user);

      await user.click(await screen.findByRole('button', { name: /Resend code/ }));

      expect(await screen.findByText(`A new code is on its way to ${MASKED}.`)).toBeInTheDocument();
      expect(sendOtpMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Verification code', { exact: false })).toHaveFocus();
      expect(screen.getByRole('button', { name: /Resend code/ })).toBeDisabled();
    });

    it('accepts a backup code instead', async () => {
      verifyBackupCodeMock.mockResolvedValue(ok({ token: 't', user: {} }));
      const user = userEvent.setup();
      renderForm();
      await submitPassword(user);

      await user.click(await screen.findByRole('button', { name: 'Use a backup code instead' }));
      expect(screen.getByRole('heading', { name: 'Use a backup code' })).toBeInTheDocument();
      const backup = screen.getByLabelText(/^Backup code/);
      await waitFor(() => expect(backup).toHaveFocus());

      await user.type(backup, 'abcde-12345');
      await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin'));
      expect(verifyBackupCodeMock).toHaveBeenCalledWith({ code: 'abcde-12345' });
      expect(verifyOtpMock).not.toHaveBeenCalled();
    });

    it('goes back to the password step on request', async () => {
      const user = userEvent.setup();
      renderForm();
      await submitPassword(user);

      await user.click(await screen.findByRole('button', { name: 'Back' }));

      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByLabelText('Password', { exact: false })).toHaveFocus(),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
