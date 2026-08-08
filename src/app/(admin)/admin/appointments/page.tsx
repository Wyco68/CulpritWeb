import type { Metadata } from 'next';
import { appointmentStatusSchema, getAppointmentService, toAppointmentView, AppointmentsTable } from '@/modules/appointments';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Appointments' };
}

// "Manage Appointments" (PROJECT_SPEC §9.2, FR-17 through FR-21). The status filter is a real
// query param read server-side (not client state) so each filtered view is its own shareable,
// bookmarkable, server-rendered request — consistent with the rest of the admin section's
// "Server Component reads, client island mutates" split.
export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;

  const parsedStatus = appointmentStatusSchema.safeParse(rawStatus);
  const activeFilter: 'all' | 'scheduled' | 'cancelled' = parsedStatus.success
    ? parsedStatus.data
    : 'all';

  const result = await getAppointmentService().list(
    parsedStatus.success ? { status: parsedStatus.data } : {},
  );
  const items = result.ok ? result.data.map(toAppointmentView) : [];

  return <AppointmentsTable items={items} activeFilter={activeFilter} />;
}
