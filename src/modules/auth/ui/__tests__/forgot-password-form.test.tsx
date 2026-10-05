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

const MASKED = 'cu•••••••••@gmail.com';
const SITE_KEY = 'site-key';
const SENT = `We sent a code to ${MASKED}. It expires 5 minutes after it was sent.`;
const EMAIL_FAILED = "We couldn't send the email. Try again in a few minutes.";

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

function renderForm(turnstileSiteKey?: string) {
  return render(<ForgotPasswordForm maskedEmail={MASKED} turnstileSiteKey={turnstileSiteKey} />);
}

async function requestCode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Send reset code' }));
  return screen.findByLabelText(/^Verification code/);
}

async function requestCodeWithCheck(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Solve check' }));
  return requestCode(user);
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

  describe('asking for a code', () => {
    it('has no email field, and says where the code will go', () => {
      renderForm();

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
      const send = screen.getByRole('button', { name: 'Send reset code' });
      // jsdom's description computation pads the emphasised address with spaces; browsers don't.
      expect(send.getAttribute('aria-describedby')).toBe('reset-request-explanation');
      expect(document.getElementById('reset-request-explanation')).toHaveTextContent(
        `We'll email an 8-digit code to the admin mailbox, ${MASKED}. Enter it on the next step with your new password.`,
      );
      // Nothing takes focus on load: a screen reader starts at the page's heading.
      expect(send).not.toHaveFocus();
    });

    it('sends an empty email (the server fills it in) and moves on with the masked address', async () => {
      const user = userEvent.setup();
      renderForm();

      const code = await requestCode(user);

      expect(requestPasswordResetMock).toHaveBeenCalledTimes(1);
      expect(requestPasswordResetMock).toHaveBeenCalledWith({ email: '' }, withoutCaptcha);
      expect(code).toHaveAccessibleDescription(SENT);
      await waitFor(() => expect(code).toHaveFocus());
      expect(screen.queryByRole('button', { name: /different email/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/If that email belongs to the admin/)).not.toBeInTheDocument();
    });

    it('stays on the first step when the email could not be sent', async () => {
      requestPasswordResetMock.mockResolvedValue({
        data: null,
        error: { status: 503, code: 'EMAIL_DELIVERY_FAILED', message: 'raw server text' },
      });
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByRole('button', { name: 'Send reset code' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(EMAIL_FAILED);
      expect(alert).not.toHaveTextContent('raw server text');
      expect(screen.queryByLabelText(/^Verification code/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send reset code' })).toBeEnabled();
    });

    it('stays on the first step for any other failure too, never showing the raw message', async () => {
      requestPasswordResetMock.mockResolvedValue({
        data: null,
        error: { status: 400, code: 'SOMETHING', message: 'raw server text' },
      });
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByRole('button', { name: 'Send reset code' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("Couldn't send a reset code. Please try again.");
      expect(alert).not.toHaveTextContent('raw server text');
      expect(screen.queryByLabelText(/^Verification code/)).not.toBeInTheDocument();
    });

    it('reports a connection failure and stays put', async () => {
      requestPasswordResetMock.mockRejectedValue(new TypeError('Failed to fetch'));
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByRole('button', { name: 'Send reset code' }));

      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't reach the server.");
      expect(screen.queryByLabelText(/^Verification code/)).not.toBeInTheDocument();
    });

    it.each([
      [{}, 'Too many requests. Please try again later.'],
      [{ 'Retry-After': '7200' }, 'Too many requests. Please try again in about 2 hours.'],
      [{ 'Retry-After': '240' }, 'Too many requests. Please try again in about 4 minutes.'],
    ])('stays on the first step when rate limited (headers %o)', async (headers, message) => {
      requestPasswordResetMock.mockImplementation(rateLimited(headers));
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByRole('button', { name: 'Send reset code' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.queryByLabelText(/^Verification code/)).not.toBeInTheDocument();
    });
  });

  describe('setting the new password', () => {
    it('resets with an empty email and without the confirmation, then goes to /login', async () => {
      resetPasswordMock.mockResolvedValue({ data: { success: true }, error: null });
      const user = userEvent.setup();
      renderForm();
      await requestCode(user);

      await fillReset(user, { code: '1234 5678' });

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'));
      expect(resetPasswordMock).toHaveBeenCalledWith({
        email: '',
        otp: '12345678',
        password: 'a-new-password',
      });
      expect(toast.success).toHaveBeenCalledWith(
        'Password changed. Sign in with your new password.',
      );
    });

    it('checks that the passwords match before submitting', async () => {
      const user = userEvent.setup();
      renderForm();
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
      renderForm();
      await requestCode(user);

      await fillReset(user);

      expect(await screen.findByRole('alert')).toHaveTextContent("That code isn't right.");
      const code = screen.getByLabelText(/^Verification code/);
      expect(code).toHaveValue('');
      expect(code).toHaveFocus();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('keeps the code and points at the password when the server rejects its length', async () => {
      resetPasswordMock.mockResolvedValue({
        data: null,
        error: { status: 400, code: 'PASSWORD_TOO_LONG' },
      });
      const user = userEvent.setup();
      renderForm();
      await requestCode(user);

      await fillReset(user);

      const password = screen.getByLabelText(/^New password/);
      await waitFor(() => expect(password).toHaveFocus());
      expect(password).toHaveAccessibleDescription(/Use at most 128 characters\./);
      expect(screen.getByLabelText(/^Verification code/)).toHaveValue('12345678');
    });

    it('resends without a check when no site key is configured', async () => {
      const user = userEvent.setup();
      renderForm();
      await requestCode(user);

      await user.click(screen.getByRole('button', { name: /Resend code/ }));

      await waitFor(() => expect(requestPasswordResetMock).toHaveBeenCalledTimes(2));
      expect(requestPasswordResetMock).toHaveBeenLastCalledWith({ email: '' }, withoutCaptcha);
      expect(await screen.findByText(`A new code is on its way to ${MASKED}.`)).toBeInTheDocument();
    });

    it('reports a failed resend email and stays on the code step', async () => {
      const user = userEvent.setup();
      renderForm();
      await requestCode(user);

      requestPasswordResetMock.mockResolvedValueOnce({
        data: null,
        error: { status: 503, code: 'EMAIL_DELIVERY_FAILED' },
      });
      await user.click(screen.getByRole('button', { name: /Resend code/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent(EMAIL_FAILED);
      expect(screen.getByLabelText(/^Verification code/)).toBeInTheDocument();
    });
  });

  describe('with Turnstile configured', () => {
    beforeEach(() => {
      issuedTokens = 0;
    });

    it('keeps "Send reset code" disabled, with the reason, until the check passes', async () => {
      const user = userEvent.setup();
      renderForm(SITE_KEY);

      expect(screen.getByRole('group', { name: 'Human check' })).toBeInTheDocument();
      const send = screen.getByRole('button', { name: 'Send reset code' });
      expect(send).toBeDisabled();
      expect(send).toHaveAccessibleDescription(/Complete the check to send a code\.$/);

      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      expect(send).toBeEnabled();
      expect(send).toHaveAccessibleDescription(/Check complete\.$/);
    });

    it('sends the token in the captcha header', async () => {
      const user = userEvent.setup();
      renderForm(SITE_KEY);

      await requestCodeWithCheck(user);

      expect(requestPasswordResetMock).toHaveBeenCalledWith({ email: '' }, withCaptcha('token-1'));
    });

    it.each([
      [400, 'MISSING_RESPONSE', "Couldn't verify you're human. Please try again."],
      [403, 'VERIFICATION_FAILED', "Couldn't verify you're human. Please try again."],
      [500, 'UNKNOWN_ERROR', 'Please try again later.'],
      [503, 'CAPTCHA_NOT_CONFIGURED', 'Password reset is unavailable right now.'],
      [503, 'EMAIL_DELIVERY_FAILED', EMAIL_FAILED],
    ])('stays on the first step after %i %s, with a fresh check', async (status, code, message) => {
      requestPasswordResetMock.mockResolvedValueOnce({ data: null, error: { status, code } });
      const user = userEvent.setup();
      renderForm(SITE_KEY);

      await user.click(screen.getByRole('button', { name: 'Solve check' }));
      await user.click(screen.getByRole('button', { name: 'Send reset code' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.queryByLabelText(/^Verification code/)).not.toBeInTheDocument();
      // The spent token is gone: the check starts over and the button waits for it again.
      const send = screen.getByRole('button', { name: 'Send reset code' });
      expect(send).toBeDisabled();
      expect(send).toHaveAccessibleDescription(/Complete the check to send a code\.$/);

      await requestCodeWithCheck(user);
      expect(requestPasswordResetMock).toHaveBeenLastCalledWith(
        { email: '' },
        withCaptcha('token-2'),
      );
    });

    it('asks for a new check before resending, then sends with its token', async () => {
      const user = userEvent.setup();
      renderForm(SITE_KEY);
      await requestCodeWithCheck(user);

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
        { email: '' },
        withCaptcha('token-2'),
      );
      expect(await screen.findByText(`A new code is on its way to ${MASKED}.`)).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Human check' })).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^Verification code/)).toHaveFocus();
    });

    it.each([
      ['a rejected check', { status: 403, code: 'VERIFICATION_FAILED' }],
      ['a rate limit', { status: 429 }],
      ['a failed email', { status: 503, code: 'EMAIL_DELIVERY_FAILED' }],
    ])('never resends on its own after %s', async (_label, error) => {
      const user = userEvent.setup();
      renderForm(SITE_KEY);
      await requestCodeWithCheck(user);

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
        { email: '' },
        withCaptcha('token-3'),
      );
    });

    it('phrases a long site-wide limit on resend from Retry-After', async () => {
      const user = userEvent.setup();
      renderForm(SITE_KEY);
      await requestCodeWithCheck(user);

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
