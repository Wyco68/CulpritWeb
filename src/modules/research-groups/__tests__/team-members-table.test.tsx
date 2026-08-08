import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamMembersTable } from '../ui/team-members-table';
import type { ResearchGroup } from '../research-group.types';
import type { TeamMember } from '../team-member.types';

const refreshMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const group: ResearchGroup = {
  id: 'g1',
  name: 'Systems Security Lab',
  description: 'desc',
  teamMembers: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function renderTable(items: TeamMember[], groups: ResearchGroup[] = [group]) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TeamMembersTable items={items} groups={groups} />
    </QueryClientProvider>,
  );
}

describe('TeamMembersTable', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows the empty state when there are no team members', () => {
    renderTable([]);
    expect(screen.getByText('No team members yet.')).toBeInTheDocument();
  });

  it('creates a team member, assigning a research group from the populated select (POST)', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    const user = userEvent.setup();
    renderTable([]);

    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByLabelText('Name', { exact: false }), 'Dr. Alex Kim');
    await user.type(screen.getByLabelText('Role', { exact: false }), 'Postdoc');
    await user.selectOptions(screen.getByLabelText('Research group', { exact: false }), 'g1');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/team-members',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const [, options] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.researchGroupId).toBe('g1');
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
