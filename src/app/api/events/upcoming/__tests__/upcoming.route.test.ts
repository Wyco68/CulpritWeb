import { describe, expect, it, vi } from 'vitest';

const getUpcomingEvents = vi.fn();

vi.mock('@/modules/appointments', async () => {
  const serializer = await import('@/modules/appointments/appointment.serializer');
  return { ...serializer, getUpcomingEventsService: () => ({ getUpcomingEvents }) };
});

const { GET } = await import('../route');

describe('GET /api/events/upcoming', () => {
  it('returns 200 with visible=false and no events when the setting is off', async () => {
    const { ok } = await import('@/modules/shared/lib/result');
    getUpcomingEvents.mockResolvedValueOnce(ok({ visible: false, events: [] }));

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ visible: false, events: [] });
  });

  it('returns 200 with the scheduled appointments, admin-declared only', async () => {
    const { ok } = await import('@/modules/shared/lib/result');
    getUpcomingEvents.mockResolvedValueOnce(
      ok({
        visible: true,
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
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.visible).toBe(true);
    expect(json.data.events).toHaveLength(1);
    expect(json.data.events[0].requesterName).toBe('Dr. Rivera');
  });
});
