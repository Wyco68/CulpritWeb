import { describe, expect, it, vi, beforeEach } from 'vitest';

const requireAdminMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  void path;
  throw new Error('NEXT_REDIRECT');
});

vi.mock('@/modules/auth', () => ({
  requireAdmin: () => requireAdminMock(),
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
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

    await expect(AdminLayout({ children: null })).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('renders the admin shell when a session is present, without redirecting', async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      data: { userId: '1', email: 'admin@example.com', name: 'Admin User' },
    });
    const { default: AdminLayout } = await import('../layout');

    const result = await AdminLayout({ children: 'content' });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
