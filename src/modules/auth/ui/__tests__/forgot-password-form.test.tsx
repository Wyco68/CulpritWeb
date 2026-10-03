import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { ForgotPasswordForm } from '../forgot-password-form';

const pushMock = vi.fn();
const requestPasswordResetMock = vi.fn();
const resetPasswordMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The Cloudflare widget is a cross-origin iframe; this stand-in hands out a new token per solve.
let issuedTokens = 0;
vi.mock('@/modules/integrations/turnstile/turnstile-widget', () => ({
  TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken(`token-${++issuedTokens}`)}>
      Solve check
    </button>
  ),
}));

// The 45 s resend cooldown is covered by its own test; here a resend is available at once.
vi.mock('../use-resend-cooldown', () => ({
  useResendCooldown: () => ({ remaining: 0, start: vi.fn() }),
}));

vi.mock('../../auth-client', () => ({
  emailOtp: {
    requestPasswordReset: (...args: unknown[]) => requestPasswordResetMock(...args),
    resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
  },
}));

const GENERIC = /If that email belongs to the admin, a code is on its way/;

/** The request's second argument: client options, with the captcha header only when solved. */
const withoutCaptcha = expect.not.objectContaining({ headers: expect.anything() });
const withCaptcha = (token: string) =>
  expect.objectContaining({ headers: { 'x-captcha-response': token } });

/** A 429 as the client reports it, after running the request's `onError` hook with the response. */
function rateLimited(headers: Record<string, string> = {}) {
  return async (_body: unknown, options: { onError?: (ctx: { response: Response }) => void }) => {
    options.onError?.({ response: new Response(null, { status: 429, headers }) });
    return { data: null, error: { status: 429 } };
  };
}

async function requestCode(user: ReturnType<typeof userEvent.setup>, email = 'admin@example.com') {
  await user.type(screen.getByLabelText(/^Email/), email);
  await user.click(screen.getByRole('button', { name: 'Send code' }));
  return screen.findByLabelText(/^Verification code/);
}

async function fillReset(
  user: ReturnType<typeof userEvent.setup>,
  {
    code = '12345678',
    password = 'a-new-password',
    confirm,
  }: { code?: string; password?: string; confirm?: string } = {},
) {
  await user.type(screen.getByLabelText(/^Verification code/), code);
  await user.type(screen.getByLabelText(/^New password/), password);
  await user.type(screen.getByLabelText(/^Confirm new password/), confirm ?? password);
  await user.click(screen.getByRole('button', { name: 'Set new password' }));
}

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    requestPasswordResetMock.mockReset();
    resetPasswordMock.mockReset();
    vi.mocked(toast.success).mockReset();
    requestPasswordResetMock.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('validates the email before requesting a code', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('shows the same generic message for any address and focuses the code field', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    const code = await requestCode(user, 'someone-else@example.com');

    expect(requestPasswordResetMock).toHaveBeenCalledWith(
      { email: 'someone-else@example.com' },
      withoutCaptcha,
    );
    expect(code).toHaveAccessibleDescription(GENERIC);
    await waitFor(() => expect(code).toHaveFocus());
    expect(screen.getByLabelText(/^Email/)).toHaveValue('someone-else@example.com');
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('readonly');
  });

  it('does not reveal an error that depends on the address — any 4xx still moves on', async () => {
    requestPasswordResetMock.mockResolvedValue({
      data: null,
      error: { status: 400, code: 'SOMETHING', message: 'User not found' },
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    const code = await requestCode(user);

    expect(code).toHaveAccessibleDescription(GENERIC);
    expect(screen.queryByText('User not found')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    [{}, 'Too many requests. Please try again later.'],
    [{ 'Retry-After': '7200' }, 'Too many requests. Please try again in about 2 hours.'],
    [{ 'Retry-After': '240' }, 'Too many requests. Please try again in about 4 minutes.'],
  ])('stays on the first step when rate limited (headers %o)', async (headers, message) => {
    requestPasswordResetMock.mockImplementation(rateLimited(headers));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/^Email/), 'admin@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByLabelText(/^Verification code/)).not.toBeInTheDocument();
  });

  it('resets the password without sending the confirmation, then goes to /login', async () => {
    resetPasswordMock.mockResolvedValue({ data: { success: true }, error: null });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await requestCode(user);

    await fillReset(user, { code: '1234 5678' });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'));
    expect(resetPasswordMock).toHaveBeenCalledWith({
      email: 'admin@example.com',
      otp: '12345678',
      password: 'a-new-password',
    });
    expect(toast.success).toHaveBeenCalledWith('Password changed. Sign in with your new password.');
  });

  it('checks that the passwords match before submitting', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await requestCode(user);

    await fillReset(user, { password: 'a-new-password', confirm: 'something-else' });

    expect(await screen.findByText("The passwords don't match.")).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('maps a wrong code to friendly copy and clears it for another try', async () => {
    resetPasswordMock.mockResolvedValue({
      data: null,
      error: { status: 400, code: 'INVALID_OTP', message: 'Invalid OTP' },
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await requestCode(user);

    await fillReset(user);

    expect(await screen.findByRole('alert')).toHaveTextContent("That code isn't right.");
    expect(screen.getByLabelText(/^Verification code/)).toHaveValue('');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('can go back and use a different email', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await requestCode(user);

    await user.click(screen.getByRole('button', { name: 'Use a different email' }));

    const email = screen.getByLabelText(/^Email/);
    expect(email).not.toHaveAttribute('readonly');
    await waitFor(() => expect(email).toHaveFocus());
  });

  it('resends without a check when no site key is configured', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await requestCode(user);

    await user.click(screen.getByRole('button', { name: /Resend code/ }));

    await waitFor(() => expect(requestPasswordResetMock).toHaveBeenCalledTimes(2));
    expect(requestPasswordResetMock).toHaveBeenLastCalledWith(
      { email: 'admin@example.com' },
      withoutCaptcha,
    );
    expect(await screen.findByText(/a new code is on its way/)).toBeInTheDocument();
  });

  describe('with Turnstile configured', () => {
    const SITE_KEY = 'site-key';

    beforeEach(() => {
      issuedTokens = 0;
    });

    it('keeps "Send code" disabled, with the reason, until the check passes', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm turnstileSiteKey={SITE_KEY} />);

      expect(screen.getByRole('group', { name: 'Human check' })).toBeInTheDocument();
      const send = screen.getByRole('button', { name: 'Send code' });
      expect(send).toBeDisabled();
      expect(send).toHaveAccessibleDescription('Complete the check to send a code.');

      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      expect(send).toBeEnabled();
      expect(send).toHaveAccessibleDescription('Check complete.');
    });

    it('sends the token in the captcha header', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm turnstileSiteKey={SITE_KEY} />);

      await user.type(screen.getByLabelText(/^Email/), 'admin@example.com');
      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      await user.click(screen.getByRole('button', { name: 'Send code' }));

      expect(await screen.findByLabelText(/^Verification code/)).toBeInTheDocument();
      expect(requestPasswordResetMock).toHaveBeenCalledWith(
        { email: 'admin@example.com' },
        withCaptcha('token-1'),
      );
    });

    it.each([
      [400, 'MISSING_RESPONSE', "Couldn't verify you're human. Please try again."],
      [403, 'VERIFICATION_FAILED', "Couldn't verify you're human. Please try again."],
      [500, 'UNKNOWN_ERROR', 'Please try again later.'],
      [503, 'CAPTCHA_NOT_CONFIGURED', 'Password reset is unavailable right now.'],
    ])('stays on the email step after %i %s, with a fresh check', async (status, code, message) => {
      requestPasswordResetMock.mockResolvedValueOnce({ data: null, error: { status, code } });
      const user = userEvent.setup();
      render(<ForgotPasswordForm turnstileSiteKey={SITE_KEY} />);

      await user.type(screen.getByLabelText(/^Email/), 'admin@example.com');
      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      await user.click(screen.getByRole('button', { name: 'Send code' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.queryByLabelText(/^Verification code/)).not.toBeInTheDocument();
      // The spent token is gone: the check starts over and the button waits for it again.
      const send = screen.getByRole('button', { name: 'Send code' });
      expect(send).toBeDisabled();
      expect(send).toHaveAccessibleDescription('Complete the check to send a code.');

      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      await user.click(send);
      await screen.findByLabelText(/^Verification code/);
      expect(requestPasswordResetMock).toHaveBeenLastCalledWith(
        { email: 'admin@example.com' },
        withCaptcha('token-2'),
      );
    });

    it('asks for a new check before resending, then sends with its token', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm turnstileSiteKey={SITE_KEY} />);
      await user.type(screen.getByLabelText(/^Email/), 'admin@example.com');
      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      await user.click(screen.getByRole('button', { name: 'Send code' }));
      await screen.findByLabelText(/^Verification code/);

      await user.click(screen.getByRole('button', { name: /Resend code/ }));

      const check = screen.getByRole('group', { name: 'Human check' });
      await waitFor(() => expect(check.parentElement).toHaveFocus());
      expect(screen.getByRole('button', { name: /Resend code/ })).toBeDisabled();
      const sendNew = screen.getByRole('button', { name: 'Send new code' });
      expect(sendNew).toBeDisabled();
      expect(sendNew).toHaveAccessibleDescription('Complete the check to send a new code.');

      // A passed check only enables the button; nothing is sent until it is clicked.
      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      expect(sendNew).toBeEnabled();
      expect(requestPasswordResetMock).toHaveBeenCalledTimes(1);
      await user.click(sendNew);

      await waitFor(() => expect(requestPasswordResetMock).toHaveBeenCalledTimes(2));
      expect(requestPasswordResetMock).toHaveBeenLastCalledWith(
        { email: 'admin@example.com' },
        withCaptcha('token-2'),
      );
      expect(await screen.findByText(/a new code is on its way/)).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Human check' })).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^Verification code/)).toHaveFocus();
    });

    it.each([
      ['a rejected check', { status: 403, code: 'VERIFICATION_FAILED' }],
      ['a rate limit', { status: 429 }],
      ['a server error', { status: 500, code: 'UNKNOWN_ERROR' }],
    ])('never resends on its own after %s', async (_label, error) => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm turnstileSiteKey={SITE_KEY} />);
      await user.type(screen.getByLabelText(/^Email/), 'admin@example.com');
      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      await user.click(screen.getByRole('button', { name: 'Send code' }));
      await screen.findByLabelText(/^Verification code/);

      requestPasswordResetMock.mockResolvedValueOnce({ data: null, error });
      await user.click(screen.getByRole('button', { name: /Resend code/ }));
      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      await user.click(screen.getByRole('button', { name: 'Send new code' }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(requestPasswordResetMock).toHaveBeenCalledTimes(2);
      // The check started over; a managed widget solving it again by itself only re-enables the
      // button — it must not send.
      expect(screen.getByRole('group', { name: 'Human check' })).toHaveTextContent(
        'Complete the check to send a new code.',
      );
      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(requestPasswordResetMock).toHaveBeenCalledTimes(2);

      await user.click(screen.getByRole('button', { name: 'Send new code' }));
      await waitFor(() => expect(requestPasswordResetMock).toHaveBeenCalledTimes(3));
      expect(requestPasswordResetMock).toHaveBeenLastCalledWith(
        { email: 'admin@example.com' },
        withCaptcha('token-3'),
      );
    });

    it('phrases a long site-wide limit on resend from Retry-After', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm turnstileSiteKey={SITE_KEY} />);
      await user.type(screen.getByLabelText(/^Email/), 'admin@example.com');
      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      await user.click(screen.getByRole('button', { name: 'Send code' }));
      await screen.findByLabelText(/^Verification code/);

      requestPasswordResetMock.mockImplementationOnce(rateLimited({ 'Retry-After': '86400' }));
      await user.click(screen.getByRole('button', { name: /Resend code/ }));
      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      await user.click(screen.getByRole('button', { name: 'Send new code' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Too many requests. Please try again in about 24 hours.',
      );
    });
  });
});
