import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const requireAdminMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});
const loginProps = vi.fn();
const resetProps = vi.fn();

const MASKED = 'cu•••••••••@gmail.com';

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock('@/modules/shared/lib/env', () => ({
  publicEnv: { turnstileSiteKey: 'site-key' },
}));

vi.mock('@/modules/auth', () => ({
  ADMIN_EMAIL_MASKED: 'cu•••••••••@gmail.com',
  requireAdmin: () => requireAdminMock(),
  LoginForm: (props: Record<string, unknown>) => {
    loginProps(props);
    return null;
  },
  ForgotPasswordForm: (props: Record<string, unknown>) => {
    resetProps(props);
    return null;
  },
}));

// The signed-out admin pages hand the client forms only the masked mailbox, never the address.
describe('signed-out admin pages', () => {
  beforeEach(() => {
    loginProps.mockReset();
    resetProps.mockReset();
    redirectMock.mockClear();
    requireAdminMock.mockResolvedValue({ ok: false, error: new Error('unauthorized') });
  });

  it('login passes the masked mailbox to the form, under one h1', async () => {
    const { default: LoginPage } = await import('../page');
    render(await LoginPage());

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Admin Login' })).toBeInTheDocument();
    expect(loginProps).toHaveBeenCalledWith({ maskedEmail: MASKED });
  });

  it('login sends a signed-in admin to the dashboard', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, data: {} });
    const { default: LoginPage } = await import('../page');

    await expect(LoginPage()).rejects.toThrow('NEXT_REDIRECT /admin');
    expect(loginProps).not.toHaveBeenCalled();
  });

  it('forgot password passes the masked mailbox and the Turnstile key', async () => {
    const { default: ForgotPasswordPage } = await import('../forgot-password/page');
    render(ForgotPasswordPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Reset Password' })).toBeInTheDocument();
    expect(resetProps).toHaveBeenCalledWith({ maskedEmail: MASKED, turnstileSiteKey: 'site-key' });
  });
});
