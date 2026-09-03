import { describe, expect, it } from 'vitest';
import { createEventSchema, updateEventSchema } from '../event.schema';

const VALID = {
  title: 'Guest lecture',
  description: 'A talk about key rotation.',
  eventDate: '2026-10-14T11:00',
};

describe('createEventSchema', () => {
  it('accepts a minimal event and leaves media absent', () => {
    const parsed = createEventSchema.parse(VALID);

    expect(parsed.title).toBe('Guest lecture');
    expect(parsed.photoUrls).toBeUndefined();
    expect(parsed.videoUrls).toBeUndefined();
  });

  it('parses a bare datetime-local value at the institution timezone, not the runner', () => {
    const parsed = createEventSchema.parse(VALID);

    // Asia/Bangkok is UTC+7 year-round, so 11:00 local is 04:00Z regardless of where this runs.
    expect(parsed.eventDate.toISOString()).toBe('2026-10-14T04:00:00.000Z');
  });

  it('round-trips a zone-explicit ISO string to the same instant', () => {
    const parsed = createEventSchema.parse({ ...VALID, eventDate: '2026-10-14T04:00:00.000Z' });

    expect(parsed.eventDate.toISOString()).toBe('2026-10-14T04:00:00.000Z');
  });

  it('strips HTML from free text', () => {
    const parsed = createEventSchema.parse({
      ...VALID,
      description: 'Talk <script>alert(1)</script> notes',
    });

    expect(parsed.description).not.toContain('<script>');
  });

  it('rejects an empty title', () => {
    expect(createEventSchema.safeParse({ ...VALID, title: '   ' }).success).toBe(false);
  });

  it('normalises every accepted YouTube URL shape to a bare video ID', () => {
    const parsed = createEventSchema.parse({
      ...VALID,
      videoUrls: [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/aQw4w9WgXcQ',
        'https://www.youtube.com/shorts/bQw4w9WgXcQ',
        'cQw4w9WgXcQ',
      ],
    });

    expect(parsed.videoUrls).toEqual(['dQw4w9WgXcQ', 'aQw4w9WgXcQ', 'bQw4w9WgXcQ', 'cQw4w9WgXcQ']);
  });

  it('rejects a video URL that is not YouTube', () => {
    const result = createEventSchema.safeParse({
      ...VALID,
      videoUrls: ['https://vimeo.com/123456789'],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a photo entry that is not a URL', () => {
    expect(createEventSchema.safeParse({ ...VALID, photoUrls: ['not-a-url'] }).success).toBe(false);
  });

  it('caps the media arrays', () => {
    const photo = 'https://cdn.example.org/a.jpg';
    expect(
      createEventSchema.safeParse({ ...VALID, photoUrls: Array(21).fill(photo) }).success,
    ).toBe(false);
    expect(
      createEventSchema.safeParse({ ...VALID, videoUrls: Array(11).fill('dQw4w9WgXcQ') }).success,
    ).toBe(false);
  });
});

describe('updateEventSchema', () => {
  it('accepts a partial patch', () => {
    const parsed = updateEventSchema.parse({ title: 'Renamed' });

    expect(parsed).toEqual({ title: 'Renamed' });
  });

  it('distinguishes an explicitly emptied gallery from an absent one', () => {
    expect(updateEventSchema.parse({ photoUrls: [] }).photoUrls).toEqual([]);
    expect(updateEventSchema.parse({ title: 'Renamed' }).photoUrls).toBeUndefined();
  });
});
