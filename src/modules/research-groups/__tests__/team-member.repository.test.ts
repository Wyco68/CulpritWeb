import { beforeEach, describe, expect, it, vi } from 'vitest';

// Prisma is faked here — no database — so what is asserted is the order and scope of the calls made
// on the transaction client: a member write, its links and its audit entry in one transaction.

const calls: string[] = [];
const tx = {
  teamMember: {
    updateMany: vi.fn(async (args: unknown) => {
      calls.push('updateMany');
      return { count: 1, args };
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      calls.push('create');
      return { id: 'new', createdAt: new Date(), updatedAt: new Date(), ...data };
    }),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        calls.push('update');
        return { id: where.id, createdAt: new Date(), updatedAt: new Date(), ...data };
      },
    ),
  },
  memberLink: {
    deleteMany: vi.fn(async () => {
      calls.push('links.deleteMany');
      return { count: 1 };
    }),
    createMany: vi.fn(async (args: unknown) => {
      calls.push('links.createMany');
      return { count: 1, args };
    }),
  },
  auditLog: {
    create: vi.fn(async () => {
      calls.push('audit');
    }),
  },
};

vi.mock('@/modules/shared/lib/prisma', () => ({
  prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) },
}));

const { PrismaTeamMemberRepository } = await import('../team-member.repository');

const AUDIT = { actor: 'admin:1', action: 'team_member.update' };

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

// Who the director is cannot be changed through the admin (ADR-020): no member write touches the
// flag, and none reaches any other member's row.
describe('PrismaTeamMemberRepository director handling', () => {
  it('never writes isDirector, and never touches another member', async () => {
    await new PrismaTeamMemberRepository().createWithAudit({
      data: { name: 'New', role: 'Professor', links: [] },
      audit: { ...AUDIT, action: 'team_member.create' },
    });
    await new PrismaTeamMemberRepository().updateWithAudit({
      id: 'someone',
      data: { name: 'Renamed', teamId: 'team_1', hiddenSections: ['courses'] },
      audit: AUDIT,
    });

    expect(tx.teamMember.updateMany).not.toHaveBeenCalled();
    const created = tx.teamMember.create.mock.calls[0]![0];
    const updated = tx.teamMember.update.mock.calls[0]![0];
    expect(created.data).not.toHaveProperty('isDirector');
    expect(updated.data).not.toHaveProperty('isDirector');
    expect(updated.data).toMatchObject({ teamId: 'team_1', hiddenSections: ['courses'] });
  });
});

// Links are part of the member aggregate, like a publication's byline rows: the payload carries the
// whole list and the repository replaces it inside the member's own transaction, next to the audit
// entry. An absent key leaves the stored list alone.
describe('PrismaTeamMemberRepository links', () => {
  it('replaces the whole list inside the same transaction as the member write', async () => {
    await new PrismaTeamMemberRepository().updateWithAudit({
      id: 'mem_1',
      data: { links: [{ label: 'GitHub', url: 'https://github.com/example' }] },
      audit: AUDIT,
    });

    expect(calls).toEqual(['update', 'links.deleteMany', 'links.createMany', 'audit']);
    expect(tx.memberLink.deleteMany).toHaveBeenCalledWith({ where: { teamMemberId: 'mem_1' } });
    expect(tx.memberLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          teamMemberId: 'mem_1',
          label: 'GitHub',
          url: 'https://github.com/example',
          sortOrder: 0,
        },
      ],
    });
  });

  it('numbers sortOrder from the array order', async () => {
    await new PrismaTeamMemberRepository().updateWithAudit({
      id: 'mem_1',
      data: {
        links: [
          { label: 'LinkedIn', url: 'https://www.linkedin.com/in/example' },
          { label: 'ORCID', url: 'https://orcid.org/0000-0000-0000-0000' },
        ],
      },
      audit: AUDIT,
    });

    const [{ data }] = tx.memberLink.createMany.mock.calls[0] as [
      { data: { sortOrder: number }[] },
    ];
    expect(data.map((link) => link.sortOrder)).toEqual([0, 1]);
  });

  it('clears the list when an empty array arrives', async () => {
    await new PrismaTeamMemberRepository().updateWithAudit({
      id: 'mem_1',
      data: { links: [] },
      audit: AUDIT,
    });

    expect(tx.memberLink.deleteMany).toHaveBeenCalledWith({ where: { teamMemberId: 'mem_1' } });
    expect(tx.memberLink.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it('leaves the list alone when the update does not mention it', async () => {
    await new PrismaTeamMemberRepository().updateWithAudit({
      id: 'mem_1',
      data: { name: 'Renamed' },
      audit: AUDIT,
    });

    expect(tx.memberLink.deleteMany).not.toHaveBeenCalled();
    expect(tx.memberLink.createMany).not.toHaveBeenCalled();
  });

  it('creates the links with the member in one transaction', async () => {
    await new PrismaTeamMemberRepository().createWithAudit({
      data: {
        name: 'New',
        role: 'Developer',
        links: [{ label: 'GitHub', url: 'https://github.com/example' }],
      },
      audit: { ...AUDIT, action: 'team_member.create' },
    });

    expect(calls).toEqual(['create', 'audit']);
    const [{ data }] = tx.teamMember.create.mock.calls[0] as [
      { data: { links: { create: { label: string; sortOrder: number }[] } } },
    ];
    expect(data.links.create).toEqual([
      { label: 'GitHub', url: 'https://github.com/example', sortOrder: 0 },
    ]);
  });
});
