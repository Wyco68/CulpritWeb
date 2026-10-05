import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const isEmailDeliveryConfiguredMock = vi.fn();
const settingsProps = vi.fn();

vi.mock('@/modules/auth', () => ({
  ADMIN_EMAIL_MASKED: 'cu•••••••••@gmail.com',
  TwoFactorSettings: (props: Record<string, unknown>) => {
    settingsProps(props);
    return null;
  },
}));

vi.mock('@/modules/integrations', () => ({
  isEmailDeliveryConfigured: () => isEmailDeliveryConfiguredMock(),
}));

describe('AdminSecurityPage', () => {
  beforeEach(() => {
    settingsProps.mockReset();
    isEmailDeliveryConfiguredMock.mockReturnValue(false);
  });

  it('passes the masked mailbox and the server-read email state, under one h1', async () => {
    const { default: AdminSecurityPage } = await import('../page');
    render(AdminSecurityPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Security' })).toBeInTheDocument();
    expect(settingsProps).toHaveBeenCalledWith({
      maskedEmail: 'cu•••••••••@gmail.com',
      emailConfigured: false,
    });
  });
});
