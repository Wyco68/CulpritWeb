import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { EventTimeline } from '../ui/event-timeline';
import type { Event } from '../event.types';

// The page is cached for a day, so the prerender's clock goes stale; the browser re-splits.

const event = (id: string, eventDate: Date): Event => ({
  id,
  title: `Event ${id}`,
  description: 'x',
  content: null,
  eventDate,
  photoUrls: [],
  videoUrls: [],
  coverPhotoUrl: null,
  coverCrop: null,
  participants: [],
  createdAt: eventDate,
  updatedAt: eventDate,
});

describe('EventTimeline', () => {
  it('files an event that has passed since the prerender under Past', () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    // Rendered "yesterday": at that time both events were still ahead.
    render(
      <EventTimeline
        events={[event('soon', nextWeek), event('done', hourAgo)]}
        renderedAt={Date.now() - 24 * 60 * 60 * 1000}
      />,
    );

    const upcoming = screen.getByRole('region', { name: 'Upcoming' });
    const past = screen.getByRole('region', { name: 'Past' });
    expect(within(upcoming).getByText('Event soon')).toBeInTheDocument();
    expect(within(upcoming).queryByText('Event done')).not.toBeInTheDocument();
    expect(within(past).getByText('Event done')).toBeInTheDocument();
  });
});
