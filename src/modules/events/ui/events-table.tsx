'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarDays, ImageIcon, Pencil, Plus, Trash2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/ui/table';
import { INSTITUTION_TIME_ZONE } from '@/modules/shared/lib/timezone';
// Deep imports, not the barrel — see event-form-dialog.tsx's comment.
import type { Event } from '../event.types';
import { EventFormDialog } from './event-form-dialog';

// Admin: Manage Events. Replaced Manage Appointments on 2026-09-01, and is a plainer screen than
// the one it replaced — an event has no status, no cancel/reschedule actions and no public/private
// toggle, so the row actions are just edit and delete.

async function deleteEvent(id: string) {
  const response = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
}

// Pinned to the institution's zone for the same reason the public list is — the admin table and
// the public page must not disagree about what day an event is on.
// `timeStyle` can't be combined with explicit date component options (day/month/year) — Intl
// throws "Invalid option : option" if you try. Spell the time out as hour/minute instead.
const dateTimeFormatter = new Intl.DateTimeFormat('en', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: INSTITUTION_TIME_ZONE,
});

export function EventsTable({ items }: { items: Event[] }) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | undefined>(undefined);
  const [deleting, setDeleting] = useState<Event | undefined>(undefined);

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      toast.success('Deleted.');
      setDeleting(undefined);
      router.refresh();
    },
    onError: () => toast.error('Could not delete. Please try again.'),
  });

  // Evaluated once per render, client-side: this is only a label, and the authoritative split is
  // done server-side on the public tab.
  const now = Date.now();

  return (
    <div id="events" className="scroll-mt-24">
      <FormSection
        title="Events"
        description="Talks, workshops and visits. Upcoming and past are split by date on the public tab."
        badge={<FormSectionCount count={items.length} />}
        action={
          <Button
            aria-label="Add event"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        }
      >

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events yet."
          description="Add the first event to show it on the public Events tab."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Media</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const upcoming = item.eventDate.getTime() >= now;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground">{item.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="tabular">{dateTimeFormatter.format(item.eventDate)}</span>
                    {/* Upcoming/past is derived from the date in the same cell, not given its own
                        column: it is a reading of that date, not a separate fact about the row. */}
                    <span className="mt-0.5 block font-mono text-xs uppercase tracking-[0.12em]">
                      {upcoming ? 'Upcoming' : 'Past'}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="size-3.5" aria-hidden="true" />
                        <span className="tabular">{item.photoUrls.length}</span>
                        <span className="sr-only">
                          {item.photoUrls.length === 1 ? 'photo' : 'photos'}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="size-3.5" aria-hidden="true" />
                        <span className="tabular">{item.videoUrls.length}</span>
                        <span className="sr-only">
                          {item.videoUrls.length === 1 ? 'video' : 'videos'}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit: ${item.title}`}
                        onClick={() => {
                          setEditing(item);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete: ${item.title}`}
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleting(item)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      </FormSection>

      <EventFormDialog open={formOpen} onOpenChange={setFormOpen} event={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete this event?"
        // Says what actually survives: the uploaded photos stay in object storage (nothing here
        // reaches into R2), and the audit entry keeps the event's before-state.
        description="The event is removed from the public tab. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
