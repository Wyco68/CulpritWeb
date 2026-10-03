import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { TwoFactorSettings } from '../two-factor-settings';

const refreshMock = vi.fn();
const enableMock = vi.fn();
const disableMock = vi.fn();
const sendOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const generateBackupCodesMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../auth-client', () => ({
  twoFactor: {
    enable: (...args: unknown[]) => enableMock(...args),
    disable: (...args: unknown[]) => disableMock(...args),
    sendOtp: (...args: unknown[]) => sendOtpMock(...args),
    verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
    generateBackupCodes: (...args: unknown[]) => generateBackupCodesMock(...args),
  },
}));

const CODES = Array.from({ length: 10 }, (_, i) => `code${i}-abcde`);
const ok = <T,>(data: T) => ({ data, error: null });

function renderSettings(props: Partial<Parameters<typeof TwoFactorSettings>[0]> = {}) {
  return render(
    <TwoFactorSettings enabled={false} emailConfigured email="admin@example.com" {...props} />,
  );
}

function openDialog() {
  return screen.getByRole('dialog');
}

/** Escape on a native <dialog>: the browser fires a cancelable `cancel` event. */
function pressEscape() {
  fireEvent(openDialog(), new Event('cancel', { cancelable: true }));
}

async function reachEnableCodesStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Turn on' }));
  await user.type(within(openDialog()).getByLabelText(/^Current password/), 'secret-password');
  await user.click(within(openDialog()).getByRole('button', { name: 'Continue' }));
  const codes = await within(openDialog()).findByRole('region', { name: 'Your backup codes' });
  // Focus moves to the codes as they appear, so a screen reader reads them first.
  await waitFor(() => expect(codes).toHaveFocus());
}

describe('TwoFactorSettings', () => {
  beforeEach(() => {
    for (const mock of [
      refreshMock,
      enableMock,
      disableMock,
      sendOtpMock,
      verifyOtpMock,
      generateBackupCodesMock,
    ]) {
      mock.mockReset();
    }
    vi.mocked(toast.success).mockReset();
  });

  it('shows the state as text, not colour alone', () => {
    const { rerender } = renderSettings();
    expect(screen.getByText('Off')).toBeInTheDocument();
    rerender(<TwoFactorSettings enabled emailConfigured email="admin@example.com" />);
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('explains and disables turning on when email delivery is not configured', () => {
    renderSettings({ emailConfigured: false });
    const button = screen.getByRole('button', { name: 'Turn on' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/Email delivery isn't configured yet/);
  });

  it('turns on in three steps: password, saved backup codes, emailed code', async () => {
    enableMock.mockResolvedValue(ok({ backupCodes: CODES }));
    sendOtpMock.mockResolvedValue(ok({ status: true }));
    verifyOtpMock.mockResolvedValue(ok({ token: 't', user: {} }));
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    const password = within(openDialog()).getByLabelText(/^Current password/);
    await waitFor(() => expect(password).toHaveFocus());
    await user.type(password, 'secret-password');
    await user.click(within(openDialog()).getByRole('button', { name: 'Continue' }));

    // Step 2: the codes, shown once, gated by the confirmation.
    expect(enableMock).toHaveBeenCalledWith({ password: 'secret-password' });
    const list = await within(openDialog()).findByRole('region', { name: 'Your backup codes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    const send = within(openDialog()).getByRole('button', { name: 'Email me a code' });
    expect(send).toBeDisabled();
    await user.click(within(openDialog()).getByLabelText(/I've saved these codes/));
    expect(send).toBeEnabled();
    expect(sendOtpMock).not.toHaveBeenCalled();
    await user.click(send);

    // Step 3: the emailed code switches it on.
    expect(sendOtpMock).toHaveBeenCalledTimes(1);
    const code = await within(openDialog()).findByLabelText(/^Verification code/);
    await waitFor(() => expect(code).toHaveFocus());
    await user.type(code, '87654321');
    await user.click(within(openDialog()).getByRole('button', { name: 'Turn on' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(verifyOtpMock).toHaveBeenCalledWith({ code: '87654321' });
    expect(toast.success).toHaveBeenCalledWith('Two-step verification is on.');
  });

  it('keeps the password step open with friendly copy on a wrong password', async () => {
    enableMock.mockResolvedValue({
      data: null,
      error: { status: 400, code: 'INVALID_PASSWORD', message: 'Invalid password' },
    });
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    await user.type(within(openDialog()).getByLabelText(/^Current password/), 'wrong');
    await user.click(within(openDialog()).getByRole('button', { name: 'Continue' }));

    expect(await within(openDialog()).findByRole('alert')).toHaveTextContent(
      "That password isn't right.",
    );
    expect(screen.queryByRole('region', { name: 'Your backup codes' })).not.toBeInTheDocument();
  });

  it('reports a failed code send on the backup codes step', async () => {
    enableMock.mockResolvedValue(ok({ backupCodes: CODES }));
    sendOtpMock.mockResolvedValue({
      data: null,
      error: { status: 503, code: 'EMAIL_DELIVERY_FAILED' },
    });
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    await user.type(within(openDialog()).getByLabelText(/^Current password/), 'secret-password');
    await user.click(within(openDialog()).getByRole('button', { name: 'Continue' }));
    await user.click(await within(openDialog()).findByLabelText(/I've saved these codes/));
    await user.click(within(openDialog()).getByRole('button', { name: 'Email me a code' }));

    expect(await within(openDialog()).findByRole('alert')).toHaveTextContent(
      "We couldn't send the code.",
    );
  });

  it('turns off after the password is confirmed', async () => {
    disableMock.mockResolvedValue(ok({ status: true }));
    const user = userEvent.setup();
    renderSettings({ enabled: true });

    await user.click(screen.getByRole('button', { name: 'Turn off' }));
    const dialog = openDialog();
    expect(dialog).toHaveAccessibleName('Turn off two-step verification?');
    await user.type(within(dialog).getByLabelText(/^Current password/), 'secret-password');
    await user.click(within(dialog).getByRole('button', { name: 'Turn off' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(disableMock).toHaveBeenCalledWith({ password: 'secret-password' });
    expect(toast.success).toHaveBeenCalledWith('Two-step verification is off.');
  });

  it('generates new backup codes and shows them once', async () => {
    generateBackupCodesMock.mockResolvedValue(ok({ status: true, backupCodes: CODES }));
    const user = userEvent.setup();
    renderSettings({ enabled: true });

    await user.click(screen.getByRole('button', { name: 'Generate new codes' }));
    await user.type(within(openDialog()).getByLabelText(/^Current password/), 'secret-password');
    await user.click(within(openDialog()).getByRole('button', { name: 'Generate codes' }));

    const list = await within(openDialog()).findByRole('region', { name: 'Your backup codes' });
    expect(within(list).getByText('code0-abcde')).toBeInTheDocument();
    expect(generateBackupCodesMock).toHaveBeenCalledWith({ password: 'secret-password' });
    const done = within(openDialog()).getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    await user.click(within(openDialog()).getByLabelText(/I've saved these codes/));
    await user.click(done);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says that other devices will be signed out when turning on or off', async () => {
    const user = userEvent.setup();
    const { rerender } = renderSettings();
    expect(
      screen.getByText(
        /A leaked or guessed password.*Other signed-in devices will be signed out\./,
      ),
    ).toBeInTheDocument();

    rerender(<TwoFactorSettings enabled emailConfigured email="admin@example.com" />);
    await user.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(openDialog()).toHaveAccessibleDescription(
      /Other signed-in devices will be signed out\./,
    );
  });

  it('starts the turn-on flow over when the server has no setup in progress', async () => {
    enableMock.mockResolvedValue(ok({ backupCodes: CODES }));
    sendOtpMock.mockResolvedValue({
      data: null,
      error: { status: 400, code: 'TWO_FACTOR_SETUP_REQUIRED' },
    });
    const user = userEvent.setup();
    renderSettings();

    await reachEnableCodesStep(user);
    await user.click(within(openDialog()).getByLabelText(/I've saved these codes/));
    await user.click(within(openDialog()).getByRole('button', { name: 'Email me a code' }));

    expect(await within(openDialog()).findByRole('alert')).toHaveTextContent(
      'Enter your password to start turning on two-step verification again.',
    );
    expect(within(openDialog()).getByLabelText(/^Current password/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your backup codes' })).not.toBeInTheDocument();
  });

  describe('unsaved backup codes', () => {
    beforeEach(() => {
      enableMock.mockResolvedValue(ok({ backupCodes: CODES }));
      generateBackupCodesMock.mockResolvedValue(ok({ status: true, backupCodes: CODES }));
    });

    it('blocks the close button until the admin confirms, then closes', async () => {
      const user = userEvent.setup();
      renderSettings();
      await reachEnableCodesStep(user);

      await user.click(within(openDialog()).getByRole('button', { name: 'Close' }));

      expect(openDialog()).toBeInTheDocument();
      expect(within(openDialog()).getByRole('alert')).toHaveTextContent(
        'Close without saving these codes?',
      );
      const keep = within(openDialog()).getByRole('button', { name: 'Keep them open' });
      await waitFor(() => expect(keep).toHaveFocus());

      await user.click(within(openDialog()).getByRole('button', { name: 'Close anyway' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('blocks Escape and Cancel too, and "Keep them open" returns to the codes', async () => {
      const user = userEvent.setup();
      renderSettings();
      await reachEnableCodesStep(user);

      pressEscape();
      expect(
        await within(openDialog()).findByText('Close without saving these codes?'),
      ).toBeInTheDocument();
      await user.click(within(openDialog()).getByRole('button', { name: 'Keep them open' }));
      expect(screen.queryByText('Close without saving these codes?')).not.toBeInTheDocument();

      await user.click(within(openDialog()).getByRole('button', { name: 'Cancel' }));
      expect(within(openDialog()).getByText('Close without saving these codes?')).toBeVisible();
      expect(within(openDialog()).getAllByRole('listitem')).toHaveLength(10);
    });

    it('closes straight away once the codes are marked as saved', async () => {
      const user = userEvent.setup();
      renderSettings();
      await reachEnableCodesStep(user);

      await user.click(within(openDialog()).getByLabelText(/I've saved these codes/));
      pressEscape();

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('guards freshly generated replacement codes the same way', async () => {
      const user = userEvent.setup();
      renderSettings({ enabled: true });

      await user.click(screen.getByRole('button', { name: 'Generate new codes' }));
      await user.type(within(openDialog()).getByLabelText(/^Current password/), 'secret-password');
      await user.click(within(openDialog()).getByRole('button', { name: 'Generate codes' }));
      await within(openDialog()).findByRole('region', { name: 'Your backup codes' });

      pressEscape();

      expect(await within(openDialog()).findByRole('alert')).toHaveTextContent(
        'Your old codes already stopped working',
      );
      expect(within(openDialog()).getByText('code0-abcde')).toBeInTheDocument();
    });
  });

  it('downloads the codes through an attached link and revokes the URL afterwards', async () => {
    enableMock.mockResolvedValue(ok({ backupCodes: CODES }));
    const createObjectURL = vi.fn(() => 'blob:codes');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    let attachedOnClick = false;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      attachedOnClick = this.isConnected;
    });
    const user = userEvent.setup();
    renderSettings();
    await reachEnableCodesStep(user);

    await user.click(within(openDialog()).getByRole('button', { name: 'Download .txt' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(attachedOnClick).toBe(true);
    expect(document.querySelector('a[download]')).toBeNull();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:codes'));
    click.mockRestore();
  });
});
