import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamsAdmin } from '../ui/teams-admin';
import type { Team } from '../team.types';

// ADR-020: the admin names and orders their own teams.

const fetchMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const team = (overrides: Partial<Team>): Team => ({
  id: 't1',
  name: 'Research Team',
  sortOrder: 1,
  memberCount: 3,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-01'),
  ...overrides,
});

function renderTeams(teams: Team[]) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TeamsAdmin teams={teams} />
    </QueryClientProvider>,
  );
}

const sent = (index = 0) => {
  const [url, init] = fetchMock.mock.calls[index]!;
  return {
    url,
    method: (init as RequestInit).method,
    body: JSON.parse(String((init as RequestInit).body ?? 'null')),
  };
};

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
  vi.stubGlobal('fetch', fetchMock);
});

describe('TeamsAdmin', () => {
  it('adds a team at the end of the order', async () => {
    const user = userEvent.setup();
    renderTeams([team({ sortOrder: 4 })]);

    await user.type(screen.getByLabelText('New team name'), 'Alumni');
    await user.click(screen.getByRole('button', { name: 'Add team' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sent()).toEqual({
      url: '/api/admin/teams',
      method: 'POST',
      body: { name: 'Alumni', sortOrder: 5 },
    });
  });

  it('saves a rename only once something changed', async () => {
    const user = userEvent.setup();
    renderTeams([team({})]);
    const save = screen.getByRole('button', { name: 'Save Research Team' });
    expect(save).toBeDisabled();

    const name = screen.getByLabelText('Name of Research Team');
    await user.clear(name);
    await user.type(name, 'Researchers');
    await user.click(save);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sent()).toEqual({
      url: '/api/admin/teams/t1',
      method: 'PUT',
      body: { name: 'Researchers', sortOrder: 1 },
    });
  });

  it('says the members stay before deleting a team', async () => {
    const user = userEvent.setup();
    renderTeams([team({})]);

    await user.click(screen.getByRole('button', { name: 'Delete Research Team' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Its 3 members stay on the site/)).toBeInTheDocument();
  });
});
