'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarClock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { StatusPill } from '@/modules/shared/ui/status-pill';
import { cn } from '@/modules/shared/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/modules/shared/ui/table';
// Type-only, so it's erased at compile time either way — imported from the concrete files rather
// than the barrel for consistency with the sibling dialogs (see cancel-dialog.tsx).
import type { AppointmentStatus, CancelAppointmentInput } from '../appointment.schema';
import type { AppointmentView } from '../appointment.serializer';
import { CancelDialog } from './cancel-dialog';
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
  const timeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const router = useRouter();

  const [cancelling, setCancelling] = useState<AppointmentView | null>(null);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Manage Appointments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Appointments you declare directly. Visitors booking via Calendly are not recorded here
            automatically — add them manually if they should appear on the public site.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add appointment
        </Button>
      </div>

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
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setCancelling(item)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
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
    </div>
  );
}
