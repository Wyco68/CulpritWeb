'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarClock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { StatusPill } from '@/modules/shared/ui/status-pill';
import { Switch } from '@/modules/shared/ui/switch';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { cn } from '@/modules/shared/lib/utils';
import { INSTITUTION_TIME_ZONE } from '@/modules/shared/lib/timezone';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/modules/shared/ui/table';
// Type-only, so it's erased at compile time either way — imported from the concrete files rather
// than the barrel for consistency with the sibling dialogs (see cancel-dialog.tsx).
import type {
  AppointmentStatus,
  CancelAppointmentInput,
  RescheduleAppointmentInput,
} from '../appointment.schema';
import type { AppointmentView } from '../appointment.serializer';
import { CancelDialog } from './cancel-dialog';
import { RescheduleDialog } from './reschedule-dialog';
import { AppointmentFormDialog } from './appointment-form-dialog';

const FILTERS = ['all', 'scheduled', 'cancelled'] as const;
type Filter = (typeof FILTERS)[number];

async function cancelAppointment(id: string, body: CancelAppointmentInput) {
  const response = await fetch(`/api/admin/appointments/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error?.message ?? 'Request failed');
  return json.data as AppointmentView;
}

async function rescheduleAppointment(id: string, body: RescheduleAppointmentInput) {
  const response = await fetch(`/api/admin/appointments/${id}/reschedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error?.message ?? 'Request failed');
  return json.data as AppointmentView;
}

async function updateAppointmentVisibility(id: string, isPublic: boolean) {
  const response = await fetch(`/api/admin/appointments/${id}/visibility`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPublic }),
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error?.message ?? 'Request failed');
  return json.data as AppointmentView;
}

async function deleteAppointment(id: string) {
  const response = await fetch(`/api/admin/appointments/${id}`, { method: 'DELETE' });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error?.message ?? 'Request failed');
}

export function AppointmentsTable({
  items,
  activeFilter,
}: {
  items: AppointmentView[];
  activeFilter: Filter;
}) {
  // Reuses the same status labels as the public site's StatusPill (`appointments.status.*`)
  // instead of duplicating them under `admin.common` — one source of truth for status copy.
  const statusLabels: Record<'scheduled' | 'cancelled', string> = {
    scheduled: 'Scheduled',
    cancelled: 'Cancelled',
  };
  // Pinned to the meeting location's zone, not the admin's current browser zone — the admin may
  // be travelling (see profile visiting-researcher history) and still needs to see the actual
  // scheduled wall-clock time at the meeting location, not a shifted local conversion.
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: INSTITUTION_TIME_ZONE,
  });
  const router = useRouter();

  const [cancelling, setCancelling] = useState<AppointmentView | null>(null);
  const [rescheduling, setRescheduling] = useState<AppointmentView | null>(null);
  const [deleting, setDeleting] = useState<AppointmentView | null>(null);
  const [editing, setEditing] = useState<AppointmentView | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);

  // Every action is enforced server-side (never mutated locally from a component).
  // `router.refresh()` re-runs the guarded Server Component page, so the table always reflects
  // the service's authoritative post-transition state, not an optimistic guess.
  const cancelMutation = useMutation({
    mutationFn: (input: CancelAppointmentInput) => cancelAppointment(cancelling!.id, input),
    onSuccess: () => {
      toast.success('Appointment cancelled.');
      setCancelling(null);
      router.refresh();
    },
    onError: () => toast.error('Could not update the appointment. Please try again.'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: (input: RescheduleAppointmentInput) => rescheduleAppointment(rescheduling!.id, input),
    onSuccess: () => {
      toast.success('Appointment rescheduled.');
      setRescheduling(null);
      router.refresh();
    },
    onError: () => toast.error('Could not reschedule the appointment. Please try again.'),
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      updateAppointmentVisibility(id, isPublic),
    onSuccess: () => {
      toast.success('Visibility updated.');
      router.refresh();
    },
    onError: () => toast.error('Could not update visibility. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: () => {
      toast.success('Appointment permanently deleted.');
      setDeleting(null);
      router.refresh();
    },
    onError: () => toast.error('Could not delete the appointment. Please try again.'),
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        as="h1"
        title="Manage Appointments"
        intro="Calendly bookings are not recorded here. Add them manually to show them publicly."
        action={
          <Button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add appointment
          </Button>
        }
      />

      <nav aria-label="Manage Appointments" className="overflow-x-auto scrollbar-hidden">
        <ul className="flex min-w-max items-center gap-1.5">
          {FILTERS.map((filter) => (
            <li key={filter}>
              <Link
                href={filter === 'all' ? '/admin/appointments' : `/admin/appointments?status=${filter}`}
                aria-current={activeFilter === filter ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  activeFilter === filter
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {filter === 'all' ? 'All' : statusLabels[filter]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No appointments yet."
          description="Appointments you add will appear here."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Research group</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Public</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{item.requesterName}</p>
                  {item.topic && <p className="text-xs text-muted-foreground">{item.topic}</p>}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.researchGroup ?? 'No research group specified'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {timeFormatter.format(item.scheduledAt)}
                </TableCell>
                <TableCell>
                  <StatusPill status={item.status as AppointmentStatus} />
                </TableCell>
                <TableCell>
                  <Switch
                    id={`visibility-${item.id}`}
                    checked={item.isPublic}
                    disabled={
                      visibilityMutation.isPending && visibilityMutation.variables?.id === item.id
                    }
                    aria-label={`${item.isPublic ? 'Public' : 'Private'} — toggle whether ${item.requesterName}'s appointment appears on the public Upcoming Events tab`}
                    onCheckedChange={(checked) =>
                      visibilityMutation.mutate({ id: item.id, isPublic: checked })
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {item.status === 'scheduled' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(item);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRescheduling(item)}
                        >
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setCancelling(item)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleting(item)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AppointmentFormDialog open={formOpen} onOpenChange={setFormOpen} appointment={editing} />
      <CancelDialog
        open={Boolean(cancelling)}
        onOpenChange={(open) => !open && setCancelling(null)}
        loading={cancelMutation.isPending}
        onConfirm={(input) => cancelMutation.mutate(input)}
      />
      <RescheduleDialog
        open={Boolean(rescheduling)}
        onOpenChange={(open) => !open && setRescheduling(null)}
        scheduledAt={rescheduling?.scheduledAt}
        loading={rescheduleMutation.isPending}
        onConfirm={(input) => rescheduleMutation.mutate(input)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Permanently delete this appointment?"
        description="This action cannot be undone — the appointment record will be permanently deleted, not cancelled or archived."
        confirmLabel="Delete"
        cancelLabel="Back"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
