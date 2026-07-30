import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createCalendlyService, type CalendlyLinkStore } from '../calendly.service';
import type { CalendlyClient } from '../calendly.client';
import { IntegrationError, NotFoundError, RateLimitError, UnauthorizedError } from '@/modules/shared/lib/errors';

const SIGNING_KEY = 'whsec_test';
const NOW_MS = new Date('2026-08-03T00:00:00Z').getTime();

function signedHeader(body: string, key = SIGNING_KEY, tSeconds = Math.floor(NOW_MS / 1000)) {
  const hmac = createHmac('sha256', key).update(`${tSeconds}.${body}`).digest('hex');
  return `t=${tSeconds},v1=${hmac}`;
}

function makeClient(overrides: Partial<CalendlyClient> = {}): CalendlyClient {
  return {
    request: vi.fn(),
    ...overrides,
  } as CalendlyClient;
}

function makeLinkStore(): CalendlyLinkStore & {
  created: unknown[];
  cancelled: unknown[];
  reconciled: unknown[];
} {
  const created: unknown[] = [];
  const cancelled: unknown[] = [];
  const reconciled: unknown[] = [];
  return {
    created,
    cancelled,
    reconciled,
    async recordBookingCreated(link) {
      created.push(link);
      return { appointmentId: `apt_${created.length}`, created: created.length === 1 };
    },
    async recordBookingCancelled(inviteeUri, reason) {
      cancelled.push({ inviteeUri, reason });
      return { appointmentId: 'apt_1', cancelled: cancelled.length === 1 };
    },
    async reconcileCancellation(eventUri, reason) {
      reconciled.push({ eventUri, reason });
      return { appointmentId: 'apt_1', cancelled: reconciled.length === 1 };
    },
  };
}

describe('CalendlyService — not configured', () => {
  it('reports isConfigured() = false and returns IntegrationError for every read/write op', async () => {
    const service = createCalendlyService({ linkStore: makeLinkStore() });

    expect(service.isConfigured()).toBe(false);

    const results = await Promise.all([
      service.getCurrentUser(),
      service.getEventTypes(),
      service.getScheduledEvents(),
      service.cancelEvent('https://api.calendly.com/scheduled_events/1'),
    ]);
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(IntegrationError);
    }
  });

  it('processWebhook without a signing key returns not-configured', async () => {
    const service = createCalendlyService({ linkStore: makeLinkStore() });
    const result = await service.processWebhook('{}', 'anything');
    expect(result.ok).toBe(false);
  });
});

describe('CalendlyService — read operations', () => {
  it('getEventTypes maps the raw collection to domain shapes', async () => {
    const client = makeClient({
      request: vi.fn().mockResolvedValue({
        collection: [
          {
            uri: 'https://api.calendly.com/event_types/1',
            name: '30 Minute Meeting',
            slug: '30min',
            active: true,
            duration: 30,
            scheduling_url: 'https://calendly.com/prof/30min',
            description_plain: 'Intro call',
          },
        ],
      }),
    });
    const service = createCalendlyService({ client, linkStore: makeLinkStore(), userUri: 'https://api.calendly.com/users/1' });

    const result = await service.getEventTypes();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([
        {
          uri: 'https://api.calendly.com/event_types/1',
          name: '30 Minute Meeting',
          slug: '30min',
          active: true,
          durationMinutes: 30,
          schedulingUrl: 'https://calendly.com/prof/30min',
          description: 'Intro call',
        },
      ]);
    }
  });

  it('getScheduledEvents forwards filters and maps events', async () => {
    const request = vi.fn().mockResolvedValue({
      collection: [
        {
          uri: 'https://api.calendly.com/scheduled_events/1',
          name: 'Meeting',
          status: 'active',
          start_time: '2026-09-01T10:00:00Z',
          end_time: '2026-09-01T10:30:00Z',
          event_type: 'https://api.calendly.com/event_types/1',
          location: { join_url: 'https://meet.example.com/x' },
          cancellation: null,
        },
      ],
    });
    const client = makeClient({ request });
    const service = createCalendlyService({ client, linkStore: makeLinkStore(), userUri: 'https://api.calendly.com/users/1' });

    const result = await service.getScheduledEvents({ status: 'active', count: 10 });
    expect(result.ok).toBe(true);
    expect(request).toHaveBeenCalledWith(
      '/scheduled_events',
      expect.objectContaining({ query: expect.objectContaining({ status: 'active', count: 10 }) }),
    );
    if (result.ok) {
      expect(result.data[0]).toMatchObject({
        uri: 'https://api.calendly.com/scheduled_events/1',
        meetingUrl: 'https://meet.example.com/x',
      });
    }
  });

  it('cancelEvent posts to the cancellation endpoint and returns the mapped event', async () => {
    const request = vi.fn().mockResolvedValue({
      resource: {
        uri: 'https://api.calendly.com/scheduled_events/1',
        name: 'Meeting',
        status: 'canceled',
        start_time: '2026-09-01T10:00:00Z',
        end_time: '2026-09-01T10:30:00Z',
        event_type: null,
        location: null,
        cancellation: { reason: 'No longer needed' },
      },
    });
    const client = makeClient({ request });
    const linkStore = makeLinkStore();
    const service = createCalendlyService({ client, linkStore });

    const result = await service.cancelEvent('https://api.calendly.com/scheduled_events/1', 'No longer needed');
    expect(request).toHaveBeenCalledWith(
      'https://api.calendly.com/scheduled_events/1/cancellation',
      expect.objectContaining({ method: 'POST', body: { reason: 'No longer needed' } }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe('canceled');

    // Local Appointment status must be synced synchronously — never left depending on a webhook
    // that may never arrive on the Free plan.
    expect(linkStore.reconciled).toEqual([
      { eventUri: 'https://api.calendly.com/scheduled_events/1', reason: 'No longer needed' },
    ]);
  });

  it('cancelEvent still returns success even if the local reconcile throws (Calendly-side result is authoritative)', async () => {
    const request = vi.fn().mockResolvedValue({
      resource: {
        uri: 'https://api.calendly.com/scheduled_events/1',
        name: 'Meeting',
        status: 'canceled',
        start_time: '2026-09-01T10:00:00Z',
        end_time: '2026-09-01T10:30:00Z',
        event_type: null,
        location: null,
        cancellation: null,
      },
    });
    const client = makeClient({ request });
    const linkStore: CalendlyLinkStore = {
      ...makeLinkStore(),
      reconcileCancellation: vi.fn().mockRejectedValue(new Error('db unavailable')),
    };
    const service = createCalendlyService({ client, linkStore });

    const result = await service.cancelEvent('https://api.calendly.com/scheduled_events/1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe('canceled');
  });

  it('propagates client errors (401/429/network) as the Result error branch', async () => {
    const service401 = createCalendlyService({
      client: makeClient({ request: vi.fn().mockRejectedValue(new UnauthorizedError('bad token')) }),
      linkStore: makeLinkStore(),
    });
    const result401 = await service401.getCurrentUser();
    expect(result401.ok).toBe(false);
    if (!result401.ok) expect(result401.error).toBeInstanceOf(UnauthorizedError);

    const service429 = createCalendlyService({
      client: makeClient({ request: vi.fn().mockRejectedValue(new RateLimitError('slow down', 12)) }),
      linkStore: makeLinkStore(),
    });
    const result429 = await service429.getCurrentUser();
    expect(result429.ok).toBe(false);
    if (!result429.ok) expect(result429.error).toBeInstanceOf(RateLimitError);

    const serviceNet = createCalendlyService({
      client: makeClient({ request: vi.fn().mockRejectedValue(new IntegrationError('network down')) }),
      linkStore: makeLinkStore(),
    });
    const resultNet = await serviceNet.getCurrentUser();
    expect(resultNet.ok).toBe(false);
    if (!resultNet.ok) expect(resultNet.error).toBeInstanceOf(IntegrationError);
  });

  it('getEventDetails maps a 404 to NotFoundError', async () => {
    const client = makeClient({ request: vi.fn().mockRejectedValue(new NotFoundError('gone')) });
    const service = createCalendlyService({ client, linkStore: makeLinkStore() });
    const result = await service.getEventDetails('https://api.calendly.com/scheduled_events/missing');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });
});

describe('CalendlyService — createBooking (Free plan)', () => {
  it('returns an honest not-supported result instead of faking a booking', async () => {
    const service = createCalendlyService({
      client: makeClient(),
      linkStore: makeLinkStore(),
      schedulingUrl: 'https://calendly.com/prof/30min',
    });
    const result = await service.createBooking();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        supported: false,
        reason: expect.stringContaining('does not offer'),
        schedulingUrl: 'https://calendly.com/prof/30min',
      });
    }
  });

  it('is available even when the client is not configured (no external call needed)', async () => {
    const service = createCalendlyService({ linkStore: makeLinkStore() });
    const result = await service.createBooking();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.supported).toBe(false);
  });
});

describe('CalendlyService — processWebhook', () => {
  const inviteeCreatedBody = JSON.stringify({
    event: 'invitee.created',
    payload: {
      uri: 'https://api.calendly.com/scheduled_events/1/invitees/abc',
      name: 'Jane Visitor',
      email: 'jane@example.com',
      event: 'https://api.calendly.com/scheduled_events/1',
      scheduled_event: {
        uri: 'https://api.calendly.com/scheduled_events/1',
        name: 'Meeting',
        status: 'active',
        start_time: '2026-09-01T10:00:00Z',
        end_time: '2026-09-01T10:30:00Z',
        event_type: 'https://api.calendly.com/event_types/1',
        location: { join_url: 'https://meet.example.com/x' },
      },
    },
  });

  it('rejects an invalid signature with UnauthorizedError, no side effects', async () => {
    const linkStore = makeLinkStore();
    const service = createCalendlyService({ linkStore, webhookSigningKey: SIGNING_KEY, now: () => NOW_MS });

    const result = await service.processWebhook(inviteeCreatedBody, 'garbage');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(UnauthorizedError);
    expect(linkStore.created).toHaveLength(0);
  });

  it('rejects a malformed body even with a header present', async () => {
    const linkStore = makeLinkStore();
    const service = createCalendlyService({ linkStore, webhookSigningKey: SIGNING_KEY, now: () => NOW_MS });
    const malformed = '{not json';
    const result = await service.processWebhook(malformed, signedHeader(malformed));
    expect(result.ok).toBe(false);
    expect(linkStore.created).toHaveLength(0);
  });

  it('applies invitee.created exactly once when the same event is replayed (idempotent)', async () => {
    const linkStore = makeLinkStore();
    const service = createCalendlyService({ linkStore, webhookSigningKey: SIGNING_KEY, now: () => NOW_MS });
    const header = signedHeader(inviteeCreatedBody);

    const first = await service.processWebhook(inviteeCreatedBody, header);
    const second = await service.processWebhook(inviteeCreatedBody, header);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok) expect(first.data).toMatchObject({ handled: true, duplicate: false });
    if (second.ok) expect(second.data).toMatchObject({ handled: false, duplicate: true });
    expect(linkStore.created).toHaveLength(2); // store called twice, but only the first counted as created
  });

  it('applies invitee.canceled and routes through the link store', async () => {
    const linkStore = makeLinkStore();
    const service = createCalendlyService({ linkStore, webhookSigningKey: SIGNING_KEY, now: () => NOW_MS });
    const body = JSON.stringify({
      event: 'invitee.canceled',
      payload: {
        uri: 'https://api.calendly.com/scheduled_events/1/invitees/abc',
        name: 'Jane Visitor',
        email: 'jane@example.com',
        event: 'https://api.calendly.com/scheduled_events/1',
        cancellation: { reason: 'Conflict' },
      },
    });
    const result = await service.processWebhook(body, signedHeader(body));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ event: 'invitee.canceled', handled: true });
    expect(linkStore.cancelled).toEqual([{ inviteeUri: 'https://api.calendly.com/scheduled_events/1/invitees/abc', reason: 'Conflict' }]);
  });

  it('acknowledges unrecognized event types without side effects', async () => {
    const linkStore = makeLinkStore();
    const service = createCalendlyService({ linkStore, webhookSigningKey: SIGNING_KEY, now: () => NOW_MS });
    const body = JSON.stringify({
      event: 'routing.form_submission.created',
      payload: {
        uri: 'https://api.calendly.com/x',
        name: '',
        email: '',
        event: 'https://api.calendly.com/scheduled_events/1',
      },
    });
    const result = await service.processWebhook(body, signedHeader(body));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ event: 'routing.form_submission.created', handled: false, duplicate: false });
    expect(linkStore.created).toHaveLength(0);
    expect(linkStore.cancelled).toHaveLength(0);
  });
});
