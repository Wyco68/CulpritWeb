import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsForm } from '../ui/settings-form';
import type { Settings } from '../setting.types';

const refreshMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderForm(settings: Settings) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsForm settings={settings} />
    </QueryClientProvider>,
  );
}

describe('SettingsForm', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('toggles Upcoming Events visibility and saves via PUT', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ ok: true, data: { upcomingEventsVisible: true } }),
    });
    const user = userEvent.setup();
    renderForm({ upcomingEventsVisible: false });

    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/settings',
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
    const [, options] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.upcomingEventsVisible).toBe(true);
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
