import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResearchGroupsTable } from '../ui/research-groups-table';
import type { ResearchGroupSummary } from '../research-group.types';

const refreshMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderTable(items: ResearchGroupSummary[]) {
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

  it('renders the member count that came back with the group', () => {
    renderTable([
      {
        id: 'g1',
        name: 'Systems Security Lab',
        description: 'desc',
        memberCount: 3,
        createdAt: new Date('2026-08-05T00:00:00Z'),
        updatedAt: new Date('2026-08-05T00:00:00Z'),
      },
    ]);
    expect(screen.getByText('Systems Security Lab')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows the empty state when there are no groups', () => {
    renderTable([]);
    expect(screen.getByText('No research groups yet.')).toBeInTheDocument();
  });

  it('creates a research group via the Add dialog (POST)', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    const user = userEvent.setup();
    renderTable([]);

    await user.click(screen.getByRole('button', { name: 'Add research group' }));
    await user.type(screen.getByLabelText('Name', { exact: false }), 'Systems Security Lab');
    await user.type(screen.getByLabelText('Description', { exact: false }), 'A group description');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/groups',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
