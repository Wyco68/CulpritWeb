import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const requireAdminMock = vi.fn();
const isEmailDeliveryConfiguredMock = vi.fn();
const settingsProps = vi.fn();

vi.mock('@/modules/auth', () => ({
  requireAdmin: () => requireAdminMock(),
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
    requireAdminMock.mockResolvedValue({
      ok: true,
      data: { userId: '1', email: 'admin@example.com', name: 'Admin', twoFactorEnabled: true },
    });
    isEmailDeliveryConfiguredMock.mockReturnValue(false);
  });

  it('passes the server-read state to the settings, under one h1', async () => {
    const { default: AdminSecurityPage } = await import('../page');
    render(await AdminSecurityPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Security' })).toBeInTheDocument();
    expect(settingsProps).toHaveBeenCalledWith({
      enabled: true,
      emailConfigured: false,
      email: 'admin@example.com',
    });
  });
});
