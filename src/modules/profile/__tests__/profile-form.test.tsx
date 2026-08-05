import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileForm } from '../ui/profile-form';
import type { Profile } from '../profile.types';

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

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('ProfileForm', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('adds a new education row and includes it in the PUT payload on save', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ ok: true, data: {} }),
    });
    const user = userEvent.setup();
    renderWithQuery(null);

    await user.type(screen.getByLabelText(/admin.profile.fullName/, { exact: false }), 'Dr. Jane Doe');
    await user.type(screen.getByLabelText(/admin.profile.titleField/, { exact: false }), 'Professor');

    const addButtons = screen.getAllByRole('button', { name: 'admin.profile.item.addItem' });
    await user.click(addButtons[0]!);

    const titleInputs = screen.getAllByLabelText('admin.profile.item.titleLabel', { exact: false });
    await user.type(titleInputs[0]!, 'PhD in Computer Science');

    await user.click(screen.getByRole('button', { name: 'admin.common.save' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, options] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.education[0].title).toBe('PhD in Computer Science');
    expect(body.fullName).toBe('Dr. Jane Doe');
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('removes a row when its delete action is used', async () => {
    const user = userEvent.setup();
    renderWithQuery({
      id: '1',
      fullName: 'Dr. Jane Doe',
      title: 'Professor',
      photoUrl: null,
      bio: null,
      positionAffiliation: null,
      education: [{ title: 'Existing degree' }],
      fellowshipsVisiting: [],
      teachingRoles: [],
      teachingAwards: [],
      scholarshipsTravelAwards: [],
      researchInterests: [],
      researchStatement: null,
      invitedTalks: [],
      updatedAt: new Date(),
    });

    expect(screen.getByDisplayValue('Existing degree')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'admin.profile.item.removeItem' }));

    expect(screen.queryByDisplayValue('Existing degree')).not.toBeInTheDocument();
  });
});
