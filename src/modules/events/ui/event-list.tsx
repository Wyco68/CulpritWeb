import { dateFormatter, EventMedia, timeFormatter } from './event-media';
import type { Event } from '../event.types';

// Upcoming events: one full card per event. A Server Component — nothing here is interactive, so
// it renders on the server like the rest of the public tabs (see PastEventList for the one part of
// the Events tab that needs a client island).

export function EventList({ events }: { events: Event[] }) {
  return (
    <ul className="flex flex-col gap-5">
      {events.map((event, index) => (
        <li
          key={event.id}
          style={{ '--i': index } as React.CSSProperties}
          className="rise grid gap-x-8 gap-y-3 rounded-[10px] border border-border bg-background p-6 shadow-hairline sm:grid-cols-[9rem_1fr] sm:p-8"
        >
          <p className="tabular font-mono text-xs uppercase leading-5 tracking-[0.12em] text-muted-foreground sm:pt-1.5">
            <time dateTime={event.eventDate.toISOString()}>
              {dateFormatter.format(event.eventDate)}
              <span className="sr-only"> at </span>
              <span className="mt-0.5 block text-foreground">
                {timeFormatter.format(event.eventDate)}
              </span>
            </time>
          </p>

          <div className="min-w-0">
            <h3 className="text-balance font-serif text-xl leading-snug text-foreground sm:text-2xl">
              {event.title}
            </h3>
            {/* `whitespace-pre-line` so the paragraph breaks the admin typed into the textarea
                survive to the page. The description is plain text (HTML is stripped at the schema
                boundary), so this is the only structure it can carry. */}
            <p className="mt-3 max-w-[62ch] whitespace-pre-line text-pretty leading-[1.7] text-muted-foreground">
              {event.description}
            </p>

            <EventMedia event={event} />
          </div>
        </li>
      ))}
    </ul>
  );
}
