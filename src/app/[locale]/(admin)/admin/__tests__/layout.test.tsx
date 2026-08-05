import { describe, expect, it, vi, beforeEach } from 'vitest';

const requireAdminMock = vi.fn();
const redirectMock = vi.fn((args: { href: string; locale: string }) => {
  void args;
  throw new Error('NEXT_REDIRECT');
});

vi.mock('@/modules/auth', () => ({
  requireAdmin: () => requireAdminMock(),
}));

vi.mock('@/i18n/navigation', () => ({
  redirect: (args: { href: string; locale: string }) => redirectMock(args),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
}));

vi.mock('../_components/admin-header', () => ({
  AdminHeader: () => null,
}));

describe('AdminLayout (server guard)', () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    redirectMock.mockClear();
  });

  it('redirects to /login when there is no admin session', async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: new Error('unauthorized') });
    const { default: AdminLayout } = await import('../layout');

    await expect(
      AdminLayout({ children: null, params: Promise.resolve({ locale: 'en' }) }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith({ href: '/login', locale: 'en' });
  });

  it('renders the admin shell when a session is present, without redirecting', async () => {
    requireAdminMock.mockResolvedValue({ ok: true, data: { userId: '1', email: 'admin@example.com' } });
    const { default: AdminLayout } = await import('../layout');

    const result = await AdminLayout({
      children: 'content',
      params: Promise.resolve({ locale: 'en' }),
    });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
