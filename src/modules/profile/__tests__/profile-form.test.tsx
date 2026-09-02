import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileForm } from '../ui/profile-form';
import type { Profile } from '../profile.types';

// Since ADR-012 this form owns the singleton profile only — identity, prose and the two external
// links. The seven CV lists it used to carry are `cv_entry` rows, edited on the Teaching screen,
// so the repeatable-row tests that lived here moved out with them.

function renderWithQuery(profile: Profile | null) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileForm profile={profile} />
    </QueryClientProvider>,
  );
}

const refreshMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const EXISTING: Profile = {
  id: '1',
  fullName: 'Dr. Jane Doe',
  title: 'Professor',
  photoUrl: null,
  bio: 'Studies adversarial failure.',
  positionAffiliation: null,
  researchStatement: null,
  linkedinUrl: null,
  googleScholarUrl: null,
  updatedAt: new Date('2026-09-02T00:00:00Z'),
};

describe('ProfileForm', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends the profile fields as a whole-document PUT and refreshes', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    const user = userEvent.setup();
    renderWithQuery(null);

    await user.type(screen.getByLabelText('Full name', { exact: false }), 'Dr. Jane Doe');
    await user.type(screen.getByLabelText('Title', { exact: false }), 'Professor');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/admin/profile');
    expect((options as RequestInit).method).toBe('PUT');

    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.fullName).toBe('Dr. Jane Doe');
    expect(body.title).toBe('Professor');
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('prefills from an existing profile', () => {
    renderWithQuery(EXISTING);

    expect(screen.getByDisplayValue('Dr. Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Studies adversarial failure.')).toBeInTheDocument();
  });

  it('no longer renders the CV list editors', () => {
    renderWithQuery(EXISTING);

    // These moved to /admin/teaching. If they reappear here, the whole-document PUT is back and
    // ADR-012's split has been undone by accident.
    expect(screen.queryByRole('button', { name: 'Add item' })).not.toBeInTheDocument();
    expect(screen.queryByText('Education')).not.toBeInTheDocument();
    expect(screen.queryByText('Teaching roles')).not.toBeInTheDocument();
  });
});
