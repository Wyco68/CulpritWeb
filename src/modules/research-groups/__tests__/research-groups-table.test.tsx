import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResearchGroupsTable } from '../ui/research-groups-table';
import type { ResearchGroup } from '../research-group.types';

const refreshMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderTable(items: ResearchGroup[]) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ResearchGroupsTable items={items} />
    </QueryClientProvider>,
  );
}

describe('ResearchGroupsTable', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows the empty state when there are no groups', () => {
    renderTable([]);
    expect(screen.getByText('admin.groups.empty')).toBeInTheDocument();
  });

  it('creates a research group via the Add dialog (POST)', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    const user = userEvent.setup();
    renderTable([]);

    await user.click(screen.getByRole('button', { name: 'admin.common.add' }));
    await user.type(screen.getByLabelText(/admin.groups.fields.name/, { exact: false }), 'Systems Security Lab');
    await user.type(
      screen.getByLabelText(/admin.groups.fields.description/, { exact: false }),
      'A group description',
    );
    await user.click(screen.getByRole('button', { name: 'admin.common.save' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/groups',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
