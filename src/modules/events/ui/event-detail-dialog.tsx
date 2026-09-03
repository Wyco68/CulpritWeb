'use client';

import { Dialog } from '@/modules/shared/ui/dialog';
import { Avatar } from '@/modules/shared/ui/avatar';
import { EventMedia, dateFormatter, timeFormatter } from './event-media';
import type { Event } from '../event.types';

// Public: everything about one event that does not fit on its card — the full write-up, the photo
// gallery, the video embeds, and the participant list.
//
// This exists so the cards can be uniform. Rendering media and a roster inline made every card as
// tall as its longest content, so a grid of events was a ragged column of wildly different heights
// and the date of the next one could be pushed off screen by the write-up of the last. The card now
// carries title, date and summary only; everything variable-length lives in here.
//
// Participants sit in a sidebar beside the prose rather than under it: at desktop width the
// write-up wants a reading measure of roughly 60 characters, which leaves the rest of a dialog
// empty. The two-column split uses that space and keeps "who was there" visible while reading.

export function EventDetailDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Event;
}) {
  if (!event) return null;

  const participants = event.participants;
  const hasMedia = event.photoUrls.length > 0 || event.videoUrls.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={event.title}
      description={`${dateFormatter.format(event.eventDate)} at ${timeFormatter.format(event.eventDate)}`}
      closeLabel="Close"
      // Wider than the default dialog: this one holds a reading column and a sidebar side by side.
      className="max-w-4xl"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0">
          {/* `whitespace-pre-line` so the paragraph breaks the admin typed survive. The text is
              plain (HTML is stripped at the schema boundary), so this is the only structure it
              can carry. */}
          <p className="max-w-[62ch] whitespace-pre-line text-pretty leading-[1.7] text-muted-foreground">
            {event.content ?? event.description}
          </p>

          {hasMedia && <EventMedia event={event} />}
        </div>

        {participants.length > 0 && (
          <aside aria-label="Participants" className="lg:border-l lg:border-border lg:pl-6">
            <h3 className="font-mono text-xs uppercase leading-5 tracking-[0.12em] text-muted-foreground">
              Participants
              <span className="tabular ml-2">{participants.length}</span>
            </h3>
            <ul className="mt-3 flex flex-col">
              {participants.map((participant) => (
                <li
                  key={participant.id}
                  className="flex min-w-0 items-center gap-2.5 border-t border-border py-2.5 first:border-t-0 first:pt-0"
                >
                  <Avatar
                    // Decorative: the name is right beside it in text, so announcing the portrait
                    // would make a screen reader say the name twice.
                    src={participant.photoUrl}
                    alt=""
                    fallback={participant.name.slice(0, 1).toUpperCase()}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {participant.name}
                    </p>
                    {participant.role && (
                      <p className="truncate text-xs text-muted-foreground">{participant.role}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </Dialog>
  );
}
