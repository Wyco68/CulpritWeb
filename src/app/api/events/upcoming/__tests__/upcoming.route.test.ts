import { describe, expect, it, vi } from 'vitest';

const getUpcomingEvents = vi.fn();

vi.mock('@/modules/appointments', async () => {
  const serializer = await import('@/modules/appointments/appointment.serializer');
  return { ...serializer, getUpcomingEventsService: () => ({ getUpcomingEvents }) };
});

const { GET } = await import('../route');

describe('GET /api/events/upcoming', () => {
  it('returns 200 with no events when nothing is opted into public visibility', async () => {
    const { ok } = await import('@/modules/shared/lib/result');
    getUpcomingEvents.mockResolvedValueOnce(ok({ events: [] }));

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ events: [] });
  });

  it('returns 200 with the scheduled, public appointments, admin-declared only', async () => {
    const { ok } = await import('@/modules/shared/lib/result');
    getUpcomingEvents.mockResolvedValueOnce(
      ok({
        events: [
          {
            id: 'apt_1',
            requesterName: 'Dr. Rivera',
            requesterEmail: 'rivera@example.com',
            researchGroup: 'Systems Security',
            scheduledAt: new Date('2026-09-01T10:00:00Z'),
            topic: 'Intro call',
            status: 'scheduled',
            cancelReason: null,
            isPublic: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.events).toHaveLength(1);
    expect(json.data.events[0].requesterName).toBe('Dr. Rivera');
  });
});
