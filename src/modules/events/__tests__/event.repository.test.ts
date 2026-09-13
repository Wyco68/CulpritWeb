import { describe, expect, it, vi } from 'vitest';

// Participant photos: the linked member's current photo wins over the snapshot. Participants added
// before a member uploaded a photo were snapshotted with `photoUrl: null` and rendered as initials
// forever, even after the member row had a photo. Name and role remain snapshots. Prisma is faked,
// so what is asserted is the mapping, not a query.

const baseParticipant = {
  eventId: 'e1',
  role: 'Designer',
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const row = {
  id: 'e1',
  title: 'Project Presentation',
  description: 'Sprint review',
  content: null,
  eventDate: new Date('2026-09-08T02:00:00Z'),
  photoUrls: [],
  videoUrls: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  participants: [
    {
      ...baseParticipant,
      id: 'p1',
      teamMemberId: 'm1',
      name: 'Snapshot Name',
      photoUrl: null,
      teamMember: { photoUrl: 'https://r2.example/new.jpg' },
    },
    {
      ...baseParticipant,
      id: 'p2',
      teamMemberId: 'm2',
      name: 'Photo Removed',
      photoUrl: 'https://r2.example/old.jpg',
      teamMember: { photoUrl: null },
    },
    {
      ...baseParticipant,
      id: 'p3',
      teamMemberId: null,
      name: 'Outside Guest',
      photoUrl: 'https://r2.example/guest.jpg',
      teamMember: null,
    },
  ],
};

const findUnique = vi.fn<(args: unknown) => Promise<typeof row>>(async () => row);

vi.mock('@/modules/shared/lib/prisma', () => ({
  prisma: { event: { findUnique: (args: unknown) => findUnique(args) } },
}));

const { PrismaEventRepository } = await import('../event.repository');

describe('PrismaEventRepository participant photos', () => {
  it("reads the linked member's photo on every event read", async () => {
    await new PrismaEventRepository().findById('e1');
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          participants: expect.objectContaining({
            include: { teamMember: { select: { photoUrl: true } } },
          }),
        },
      }),
    );
  });

  it("prefers the member's current photo, falling back to the snapshot", async () => {
    const event = await new PrismaEventRepository().findById('e1');
    const [linked, removed, guest] = event!.participants;

    expect(linked!.photoUrl).toBe('https://r2.example/new.jpg');
    expect(removed!.photoUrl).toBe('https://r2.example/old.jpg');
    expect(guest!.photoUrl).toBe('https://r2.example/guest.jpg');
  });

  it('keeps name and role as snapshots', async () => {
    const event = await new PrismaEventRepository().findById('e1');
    expect(event!.participants[0]).toMatchObject({ name: 'Snapshot Name', role: 'Designer' });
  });
});
