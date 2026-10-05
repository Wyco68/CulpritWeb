import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { TwoFactorSettings } from '../two-factor-settings';

const generateBackupCodesMock = vi.fn();

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../auth-client', () => ({
  twoFactor: {
    generateBackupCodes: (...args: unknown[]) => generateBackupCodesMock(...args),
  },
}));

const MASKED = 'cu•••••••••@gmail.com';
const CODES = Array.from({ length: 10 }, (_, i) => `code${i}-abcde`);
const ok = <T,>(data: T) => ({ data, error: null });

function renderSettings(props: Partial<Parameters<typeof TwoFactorSettings>[0]> = {}) {
  return render(<TwoFactorSettings maskedEmail={MASKED} emailConfigured {...props} />);
}

function openDialog() {
  return screen.getByRole('dialog');
}

/** Escape on a native <dialog>: the browser fires a cancelable `cancel` event. */
function pressEscape() {
  fireEvent(openDialog(), new Event('cancel', { cancelable: true }));
}

async function reachCodes(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Generate backup codes' }));
  const password = within(openDialog()).getByLabelText(/^Current password/);
  await waitFor(() => expect(password).toHaveFocus());
  await user.type(password, 'secret-password');
  await user.click(within(openDialog()).getByRole('button', { name: 'Generate codes' }));
  const codes = await within(openDialog()).findByRole('region', { name: 'Your backup codes' });
  // Focus moves to the codes as they appear, so a screen reader reads them first.
  await waitFor(() => expect(codes).toHaveFocus());
  return codes;
}

describe('TwoFactorSettings', () => {
  beforeEach(() => {
    generateBackupCodesMock.mockReset();
    generateBackupCodesMock.mockResolvedValue(ok({ status: true, backupCodes: CODES }));
    vi.mocked(toast.success).mockReset();
  });

  it('says it is always on, as text, and where the codes go', () => {
    renderSettings();

    const section = screen.getByRole('region', { name: 'Two-step verification' });
    expect(within(section).getByText('Always on')).toBeInTheDocument();
    expect(
      within(section).getByText(
        `Two-step verification is always on. Sign-in codes are emailed to ${MASKED}.`,
      ),
    ).toBeInTheDocument();
  });

  it('offers no way to turn two-step verification on or off', () => {
    renderSettings();

    expect(screen.queryByRole('button', { name: /Turn (on|off)/ })).not.toBeInTheDocument();
  });

  it('warns that sign-in codes cannot be sent only when email delivery is not configured', () => {
    const { rerender } = renderSettings();
    expect(screen.queryByText("Sign-in codes can't be sent.")).not.toBeInTheDocument();

    rerender(<TwoFactorSettings maskedEmail={MASKED} emailConfigured={false} />);
    expect(screen.getByText("Sign-in codes can't be sent.")).toBeInTheDocument();
    expect(screen.getByText(/a backup code is the only way to sign in/)).toBeInTheDocument();
    // Still possible to make the codes that are now the only way in.
    expect(screen.getByRole('button', { name: 'Generate backup codes' })).toBeEnabled();
  });

  it('generates backup codes after the password and shows them once', async () => {
    const user = userEvent.setup();
    renderSettings();

    const list = await reachCodes(user);

    expect(generateBackupCodesMock).toHaveBeenCalledWith({ password: 'secret-password' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    expect(openDialog()).toHaveAccessibleName('Save your backup codes');
    expect(toast.success).toHaveBeenCalledWith(
      'Backup codes generated. Any earlier ones no longer work.',
    );
    const done = within(openDialog()).getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    await user.click(within(openDialog()).getByLabelText(/I've saved these codes/));
    await user.click(done);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the password step open with friendly copy on a wrong password', async () => {
    generateBackupCodesMock.mockResolvedValue({
      data: null,
      error: { status: 400, code: 'INVALID_PASSWORD', message: 'Invalid password' },
    });
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: 'Generate backup codes' }));
    const password = within(openDialog()).getByLabelText(/^Current password/);
    await user.type(password, 'wrong');
    await user.click(within(openDialog()).getByRole('button', { name: 'Generate codes' }));

    expect(await within(openDialog()).findByRole('alert')).toHaveTextContent(
      "That password isn't right.",
    );
    expect(within(openDialog()).queryByText('Invalid password')).not.toBeInTheDocument();
    expect(password).toHaveValue('');
    expect(screen.queryByRole('region', { name: 'Your backup codes' })).not.toBeInTheDocument();
  });

  it('starts over with the password each time the dialog opens', async () => {
    const user = userEvent.setup();
    renderSettings();
    await reachCodes(user);
    await user.click(within(openDialog()).getByLabelText(/I've saved these codes/));
    await user.click(within(openDialog()).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Generate backup codes' }));

    expect(within(openDialog()).getByLabelText(/^Current password/)).toBeInTheDocument();
    expect(screen.queryByText('code0-abcde')).not.toBeInTheDocument();
  });

  describe('unsaved backup codes', () => {
    it('blocks the close button until the admin confirms, then closes', async () => {
      const user = userEvent.setup();
      renderSettings();
      await reachCodes(user);

      await user.click(within(openDialog()).getByRole('button', { name: 'Close' }));

      expect(openDialog()).toBeInTheDocument();
      expect(within(openDialog()).getByRole('alert')).toHaveTextContent(
        'Close without saving these codes?',
      );
      expect(within(openDialog()).getByRole('alert')).toHaveTextContent(
        'Any earlier codes already stopped working',
      );
      const keep = within(openDialog()).getByRole('button', { name: 'Keep them open' });
      await waitFor(() => expect(keep).toHaveFocus());

      await user.click(within(openDialog()).getByRole('button', { name: 'Close anyway' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('blocks Escape too, and "Keep them open" returns to the codes', async () => {
      const user = userEvent.setup();
      renderSettings();
      await reachCodes(user);

      pressEscape();
      expect(
        await within(openDialog()).findByText('Close without saving these codes?'),
      ).toBeInTheDocument();
      await user.click(within(openDialog()).getByRole('button', { name: 'Keep them open' }));

      expect(screen.queryByText('Close without saving these codes?')).not.toBeInTheDocument();
      expect(within(openDialog()).getAllByRole('listitem')).toHaveLength(10);
    });

    it('closes straight away once the codes are marked as saved', async () => {
      const user = userEvent.setup();
      renderSettings();
      await reachCodes(user);

      await user.click(within(openDialog()).getByLabelText(/I've saved these codes/));
      pressEscape();

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
  });

  it('downloads the codes through an attached link and revokes the URL afterwards', async () => {
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
    await reachCodes(user);

    await user.click(within(openDialog()).getByRole('button', { name: 'Download .txt' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(attachedOnClick).toBe(true);
    expect(document.querySelector('a[download]')).toBeNull();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:codes'));
    click.mockRestore();
  });
});
