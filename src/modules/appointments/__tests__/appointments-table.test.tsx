import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppointmentsTable } from '../ui/appointments-table';
import type { AppointmentView } from '../appointment.serializer';

const refreshMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderTable(items: AppointmentView[]) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppointmentsTable items={items} activeFilter="all" />
    </QueryClientProvider>,
  );
}

function makeAppointment(overrides: Partial<AppointmentView> = {}): AppointmentView {
  return {
    id: 'a1',
    requesterName: 'Dr. Rivera',
    requesterEmail: 'rivera@example.com',
    researchGroup: 'Systems Security',
    scheduledAt: new Date('2026-09-01T10:00:00Z'),
    topic: 'Intro call',
    status: 'scheduled',
    cancelReason: null,
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AppointmentsTable', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows the empty state when there are no appointments', () => {
    renderTable([]);
    expect(screen.getByText('No appointments yet.')).toBeInTheDocument();
  });

  it('shows Edit/Reschedule/Cancel/Delete for a scheduled appointment', () => {
    renderTable([makeAppointment()]);
    const row = screen.getByText('Dr. Rivera').closest('tr')!;
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Reschedule' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('only shows Delete (no Edit/Reschedule/Cancel) for a cancelled appointment', () => {
    renderTable([makeAppointment({ status: 'cancelled' })]);
    const row = screen.getByText('Dr. Rivera').closest('tr')!;
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('shows a visibility switch reflecting isPublic for every row regardless of status', () => {
    renderTable([makeAppointment({ isPublic: true }), makeAppointment({ id: 'a2', status: 'cancelled' })]);
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
    expect(switches[0]).toBeChecked();
    expect(switches[1]).not.toBeChecked();
  });

  it('cancelling requires a reason and posts to /cancel', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    const user = userEvent.setup();
    renderTable([makeAppointment()]);

    const row = screen.getByText('Dr. Rivera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Cancel' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel this appointment?' });
    // The dialog has two buttons labelled "Cancel" — an outline one that closes the dialog and a
    // destructive one that submits — so disambiguate by submit type rather than accessible name.
    const submitCancel = () =>
      within(dialog)
        .getAllByRole('button', { name: 'Cancel' })
        .find((button) => button.getAttribute('type') === 'submit')!;

    await user.click(submitCancel());
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(
      within(dialog).getByLabelText(/Reason/, { exact: false }),
      'Visitor requested cancellation',
    );
    await user.click(submitCancel());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/appointments/a1/cancel',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('toggling the visibility switch patches /visibility with the new value', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    const user = userEvent.setup();
    renderTable([makeAppointment({ isPublic: false })]);

    await user.click(screen.getByRole('switch'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/appointments/a1/visibility',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ isPublic: true }),
        }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('deleting requires confirmation and calls DELETE on /api/admin/appointments/:id', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: null }) });
    const user = userEvent.setup();
    renderTable([makeAppointment()]);

    const row = screen.getByText('Dr. Rivera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Permanently delete this appointment?' });
    expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/appointments/a1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('rescheduling posts the new date/time to /reschedule', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    const user = userEvent.setup();
    renderTable([makeAppointment()]);

    const row = screen.getByText('Dr. Rivera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Reschedule' }));
    const dialog = screen.getByRole('dialog', { name: 'Reschedule this appointment?' });

    const input = within(dialog).getByLabelText(/Date & time/, { exact: false });
    await user.clear(input);
    await user.type(input, '2026-10-15T14:30');
    await user.click(within(dialog).getByRole('button', { name: 'Reschedule' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/appointments/a1/reschedule',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('opens the add-appointment dialog from the header button', async () => {
    const user = userEvent.setup();
    renderTable([]);
    await user.click(screen.getByRole('button', { name: 'Add appointment' }));
    expect(screen.getByRole('dialog', { name: 'Add appointment' })).toBeInTheDocument();
  });
});
