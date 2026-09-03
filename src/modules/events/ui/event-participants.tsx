import { Avatar } from '@/modules/shared/ui/avatar';
import type { EventParticipant } from '../event.types';

// Public: who took part in an event. Server Component — nothing here is interactive.
//
// Every value rendered is the snapshot stored on the participant row, never a live read through
// the team-member relation. That is the point of the snapshot: a past event keeps saying who was
// there under the name and title they held at the time, even after the person is renamed, moved to
// another group, or deleted outright.
//
// Team members and guests deliberately render in one list rather than two. From a reader's point
// of view they are all just people who were at the event; splitting them would advertise an
// internal distinction ("staff" vs "outsider") that nobody visiting the page is asking about. The
// role line already says who each person is.

export function EventParticipants({ participants }: { participants: EventParticipant[] }) {
  if (participants.length === 0) return null;

  return (
    <section aria-label="Participants" className="mt-6">
      <h4 className="font-mono text-xs uppercase leading-5 tracking-[0.12em] text-muted-foreground">
        Participants
      </h4>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        {participants.map((participant) => (
          <li key={participant.id} className="flex min-w-0 items-center gap-2.5">
            <Avatar
              // Decorative: the name sits right beside it in text, so announcing the portrait
              // again would just make a screen reader say the name twice.
              src={participant.photoUrl}
              alt=""
              fallback={participant.name.slice(0, 1).toUpperCase()}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{participant.name}</p>
              {participant.role && (
                <p className="truncate text-xs text-muted-foreground">{participant.role}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
