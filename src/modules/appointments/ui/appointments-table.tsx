'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/modules/shared/ui/button';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { StatusPill } from '@/modules/shared/ui/status-pill';
import { cn } from '@/modules/shared/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/modules/shared/ui/table';
// Type-only, so it's erased at compile time either way — imported from the concrete files rather
// than the barrel for consistency with the sibling dialogs (see decline-dialog.tsx).
import type { AdminBookInput, AdminCancelInput, AdminDeclineInput, AppointmentStatus } from '../appointment.schema';
import type { AppointmentView } from '../appointment.serializer';
import { DeclineDialog } from './decline-dialog';
import { CancelDialog } from './cancel-dialog';
import { BookDialog } from './book-dialog';

const FILTERS = ['all', 'pending', 'approved', 'booked', 'declined', 'cancelled'] as const;
type Filter = (typeof FILTERS)[number];

async function postAction<T>(id: string, action: string, body?: T) {
  const response = await fetch(`/api/admin/appointments/${id}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
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
  const t = useTranslations('admin.appointments');
  // Reuses the same status labels as the public site's StatusPill (`appointments.status.*`)
  // instead of duplicating them under `admin.common` — one source of truth for status copy.
  const tStatus = useTranslations('appointments.status');
  const timeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const router = useRouter();

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [declining, setDeclining] = useState<AppointmentView | null>(null);
  const [cancelling, setCancelling] = useState<AppointmentView | null>(null);
  const [booking, setBooking] = useState<AppointmentView | null>(null);

  // Every action is a real state-machine transition enforced server-side (never mutated locally
  // from a component). `router.refresh()` re-runs the guarded Server Component page, so the table
  // always reflects the service's authoritative post-transition state, not an optimistic guess.
  const approveMutation = useMutation({
    mutationFn: (id: string) => postAction(id, 'approve'),
    onMutate: (id) => setApprovingId(id),
    onSuccess: () => {
      toast.success(t('approveSuccess'));
      router.refresh();
    },
    onError: () => toast.error(t('actionError')),
    onSettled: () => setApprovingId(null),
  });

  const declineMutation = useMutation({
    mutationFn: (input: AdminDeclineInput) => postAction(declining!.id, 'decline', input),
    onSuccess: () => {
      toast.success(t('declineSuccess'));
      setDeclining(null);
      router.refresh();
    },
    onError: () => toast.error(t('actionError')),
  });

  const cancelMutation = useMutation({
    mutationFn: (input: AdminCancelInput) => postAction(cancelling!.id, 'cancel', input),
    onSuccess: () => {
      toast.success(t('cancelSuccess'));
      setCancelling(null);
      router.refresh();
    },
    onError: () => toast.error(t('actionError')),
  });

  const bookMutation = useMutation({
    mutationFn: (input: AdminBookInput) => postAction(booking!.id, 'book', input),
    onSuccess: () => {
      toast.success(t('bookSuccess'));
      setBooking(null);
      router.refresh();
    },
    onError: () => toast.error(t('actionError')),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <nav aria-label={t('title')} className="overflow-x-auto scrollbar-hidden">
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
                {filter === 'all' ? t('filterAll') : tStatus(filter)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {items.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t('empty')} description={t('emptyBody')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.requester')}</TableHead>
              <TableHead>{t('columns.researchGroup')}</TableHead>
              <TableHead>{t('columns.time')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead className="text-right">{t('columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const time = item.scheduledAt ?? item.requestedTime;
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{item.requesterName}</p>
                    <p className="text-xs text-muted-foreground">{item.requesterEmail}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.researchGroup ?? t('noResearchGroup')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {time ? timeFormatter.format(time) : t('noTime')}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={item.status as AppointmentStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {item.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            loading={approveMutation.isPending && approvingId === item.id}
                            onClick={() => approveMutation.mutate(item.id)}
                          >
                            {t('approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setDeclining(item)}
                          >
                            {t('decline')}
                          </Button>
                        </>
                      )}
                      {item.status === 'approved' && (
                        <>
                          <Button size="sm" onClick={() => setBooking(item)}>
                            {t('markBooked')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setCancelling(item)}
                          >
                            {t('cancel')}
                          </Button>
                        </>
                      )}
                      {item.status === 'booked' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setCancelling(item)}
                        >
                          {t('cancel')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <DeclineDialog
        open={Boolean(declining)}
        onOpenChange={(open) => !open && setDeclining(null)}
        loading={declineMutation.isPending}
        onConfirm={(input) => declineMutation.mutate(input)}
      />
      <CancelDialog
        open={Boolean(cancelling)}
        onOpenChange={(open) => !open && setCancelling(null)}
        loading={cancelMutation.isPending}
        onConfirm={(input) => cancelMutation.mutate(input)}
      />
      <BookDialog
        open={Boolean(booking)}
        onOpenChange={(open) => !open && setBooking(null)}
        loading={bookMutation.isPending}
        onConfirm={(input) => bookMutation.mutate(input)}
      />
    </div>
  );
}
