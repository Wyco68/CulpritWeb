import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppointmentsTable } from '../ui/appointments-table';
import type { AppointmentView } from '../appointment.serializer';

const refreshMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
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

function makeAppointment(overrides: Partial<AppointmentView>): AppointmentView {
  return {
    id: 'a1',
    requesterName: 'Dr. Rivera',
    requesterEmail: 'rivera@example.com',
    researchGroup: 'Systems Security',
    requestedTime: new Date('2026-09-01T10:00:00Z'),
    topic: 'Intro call',
    source: 'request',
    status: 'pending',
    calendlyEventRef: null,
    cancelReason: null,
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
    expect(screen.getByText('admin.appointments.empty')).toBeInTheDocument();
  });

  it('shows Approve/Decline for pending, and Approve calls the approve endpoint', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    const user = userEvent.setup();
    renderTable([makeAppointment({ status: 'pending' })]);

    const row = screen.getByText('Dr. Rivera').closest('tr')!;
    expect(within(row).getByRole('button', { name: 'admin.appointments.approve' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'admin.appointments.decline' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'admin.appointments.markBooked' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'admin.appointments.cancel' })).not.toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'admin.appointments.approve' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/appointments/a1/approve',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('declining a pending request opens a reason dialog and posts to /decline', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    const user = userEvent.setup();
    renderTable([makeAppointment({ status: 'pending' })]);

    const row = screen.getByText('Dr. Rivera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'admin.appointments.decline' }));

    const dialog = screen.getByRole('dialog', { name: 'admin.appointments.declineDialogTitle' });
    await user.type(
      within(dialog).getByLabelText(/admin.appointments.declineReasonLabel/, { exact: false }),
      'Not a good fit',
    );
    await user.click(within(dialog).getByRole('button', { name: 'admin.appointments.decline' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/appointments/a1/decline',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows Mark booked/Cancel for approved, and hides Approve/Decline', () => {
    renderTable([makeAppointment({ status: 'approved' })]);
    const row = screen.getByText('Dr. Rivera').closest('tr')!;
    expect(within(row).getByRole('button', { name: 'admin.appointments.markBooked' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'admin.appointments.cancel' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'admin.appointments.approve' })).not.toBeInTheDocument();
  });

  it('marking an approved appointment booked requires a Calendly event reference and posts to /book', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    const user = userEvent.setup();
    renderTable([makeAppointment({ status: 'approved' })]);

    const row = screen.getByText('Dr. Rivera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'admin.appointments.markBooked' }));

    const dialog = screen.getByRole('dialog', { name: 'admin.appointments.bookDialogTitle' });
    // Submitting without the required Calendly reference should not call the API.
    await user.click(within(dialog).getByRole('button', { name: 'admin.appointments.markBooked' }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(
      within(dialog).getByLabelText(/admin.appointments.calendlyEventRefLabel/, { exact: false }),
      'evt_123',
    );
    await user.click(within(dialog).getByRole('button', { name: 'admin.appointments.markBooked' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/appointments/a1/book',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows only Cancel for booked, and cancelling requires a reason and posts to /cancel', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true, data: {} }) });
    const user = userEvent.setup();
    renderTable([makeAppointment({ status: 'booked', source: 'direct' })]);

    const row = screen.getByText('Dr. Rivera').closest('tr')!;
    expect(within(row).getByRole('button', { name: 'admin.appointments.cancel' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'admin.appointments.markBooked' })).not.toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'admin.appointments.cancel' }));
    const dialog = screen.getByRole('dialog', { name: 'admin.appointments.cancelDialogTitle' });

    await user.click(within(dialog).getByRole('button', { name: 'admin.appointments.cancel' }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(
      within(dialog).getByLabelText(/admin.appointments.cancelReasonLabel/, { exact: false }),
      'Visitor requested cancellation',
    );
    await user.click(within(dialog).getByRole('button', { name: 'admin.appointments.cancel' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/appointments/a1/cancel',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows no action buttons for terminal declined/cancelled appointments', () => {
    renderTable([
      makeAppointment({ id: 'd1', status: 'declined' }),
      makeAppointment({ id: 'c1', status: 'cancelled' }),
    ]);
    const rows = screen.getAllByText('Dr. Rivera').map((el) => el.closest('tr')!);
    for (const row of rows) {
      expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    }
  });
});
