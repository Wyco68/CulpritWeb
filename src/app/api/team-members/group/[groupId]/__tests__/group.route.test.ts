import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.fn();

beforeEach(() => {
  list.mockClear();
});

vi.mock('@/modules/research-groups', async () => {
  const schema = await import('@/modules/research-groups/team-member.schema');
  return { ...schema, getTeamMemberService: () => ({ list }) };
});

const { GET } = await import('../route');

function makeCtx(groupId: string) {
  return { params: Promise.resolve({ groupId }) };
}

describe('GET /api/team-members/group/[groupId]', () => {
  it('returns 200 with the group members', async () => {
    const { ok } = await import('@/modules/shared/lib/result');
    list.mockResolvedValueOnce(
      ok([
        {
          id: 'tm_1',
          name: 'Jane Doe',
          role: 'PhD Candidate',
          bio: null,
          photoUrl: null,
          researchGroupId: 'group_1',
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    );

    const req = {} as never;
    const res = await GET(req, makeCtx('group_1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(list).toHaveBeenCalledWith({ groupId: 'group_1' });
  });

  it('returns 200 with an empty array for a nonexistent groupId (no NotFoundError)', async () => {
    const { ok } = await import('@/modules/shared/lib/result');
    list.mockResolvedValueOnce(ok([]));

    const req = {} as never;
    const res = await GET(req, makeCtx('no_such_group'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('returns 400 for an empty groupId', async () => {
    const req = {} as never;
    const res = await GET(req, makeCtx(''));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('validation_error');
    expect(list).not.toHaveBeenCalled();
  });
});
