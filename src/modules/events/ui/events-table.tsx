'use client';

import { useState } from 'react';
import { CalendarClock, CalendarDays, History, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useDeleteRecord } from '@/modules/shared/lib/use-delete-record';
import { Button } from '@/modules/shared/ui/button';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { RecordIdentity, RecordTable } from '@/modules/shared/ui/record-table';
import { INSTITUTION_TIME_ZONE } from '@/modules/shared/lib/timezone';
// Deep imports, not the barrel — see event-form-dialog.tsx's comment.
import type { Event } from '../event.types';
import { EventFormDialog } from './event-form-dialog';
import {
  EventParticipantsDialog,
  type ParticipantPerson,
} from './event-participants-dialog';

// Admin: Manage Events. Replaced Manage Appointments on 2026-09-01, and is a plainer screen than
// the one it replaced — an event has no status, no cancel/reschedule actions and no public/private
// toggle, so the row actions are participants, edit and delete.

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

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function EventsTable({
  items,
  members = [],
}: {
  items: Event[];
  /** Pickers for the participants dialog. Default empty so the table still renders without them. */
  members?: ParticipantPerson[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | undefined>(undefined);
  const [participantsFor, setParticipantsFor] = useState<Event | undefined>(undefined);

  // Re-read from `items` on every render rather than holding the opened event in state: the dialog
  // mutates participants and calls router.refresh(), so the copy captured when it opened would go
  // stale the moment somebody was added.
  const participantsEvent = participantsFor
    ? (items.find((item) => item.id === participantsFor.id) ?? participantsFor)
    : undefined;

  const remove = useDeleteRecord<Event>((id) => `/api/admin/events/${id}`);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

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
          <Button aria-label="Add event" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        }
      >
        <RecordTable
          items={items}
          noun="events"
          searchText={(item) =>
            [item.title, ...item.participants.map((person) => person.name)].join(' ')
          }
          identityHeader="Event"
          identity={(item) => (
            <RecordIdentity
              title={item.title}
              detail={<span className="tabular">{dateTimeFormatter.format(item.eventDate)}</span>}
            />
          )}
          statusHeader="Timing"
          // Derived from the date, never stored — the same reading the public tab makes.
          status={(item) =>
            item.eventDate.getTime() >= now
              ? { tone: 'ok', label: 'Upcoming', icon: CalendarClock }
              : { tone: 'neutral', label: 'Past', icon: History }
          }
          groupHeader="Media"
          group={(item) => (
            <span className="text-xs">
              {[
                countLabel(item.photoUrls.length, 'photo'),
                countLabel(item.videoUrls.length, 'video'),
                countLabel(item.participants.length, 'person', 'people'),
              ].join(' · ')}
            </span>
          )}
          rowLabel={(item) => `Actions: ${item.title}`}
          actions={(item) => [
            {
              label: 'Participants',
              ariaLabel: `Participants: ${item.title}`,
              icon: Users,
              onSelect: () => setParticipantsFor(item),
            },
            {
              label: 'Edit',
              ariaLabel: `Edit: ${item.title}`,
              icon: Pencil,
              onSelect: () => {
                setEditing(item);
                setFormOpen(true);
              },
            },
            {
              label: 'Delete',
              ariaLabel: `Delete: ${item.title}`,
              icon: Trash2,
              destructive: true,
              onSelect: () => remove.request(item),
            },
          ]}
          empty={{
            icon: CalendarDays,
            title: 'No events yet.',
            description: 'Events appear on the public Events tab, split into upcoming and past.',
            action: { label: 'Add your first event', onClick: openCreate },
          }}
        />
      </FormSection>

      <EventFormDialog open={formOpen} onOpenChange={setFormOpen} event={editing} />

      <EventParticipantsDialog
        open={Boolean(participantsFor)}
        onOpenChange={(open) => !open && setParticipantsFor(undefined)}
        event={participantsEvent}
        members={members}
      />

      <ConfirmDialog
        {...remove.dialogProps}
        title="Delete this event?"
        // Says what actually survives: the uploaded photos stay in object storage (nothing here
        // reaches into R2), and the audit entry keeps the event's before-state.
        description="The event is removed from the public tab. This action cannot be undone."
        confirmationText="delete"
      />
    </div>
  );
}
