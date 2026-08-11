import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.fn();

vi.mock('@/modules/research-groups', () => ({ getTeamMemberService: () => ({ list }) }));

const { GET } = await import('../route');

beforeEach(() => {
  list.mockClear();
});

function makeRequest(url: string) {
  return new NextRequest(url);
}

describe('GET /api/team-members', () => {
  it('returns 200 with all team members, unfiltered', async () => {
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

    const res = await GET(makeRequest('https://example.com/api/team-members'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(list).toHaveBeenCalledWith();
  });

  it('maps an unexpected service throw to a safe 500 envelope', async () => {
    list.mockRejectedValueOnce(new Error('db unavailable'));

    const res = await GET(makeRequest('https://example.com/api/team-members'));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it('redirects old ?groupId= callers to the new filtered route (307), without touching the service', async () => {
    const res = await GET(makeRequest('https://example.com/api/team-members?groupId=group_1'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://example.com/api/team-members/group/group_1');
    expect(list).not.toHaveBeenCalled();
  });

  it('URL-encodes a groupId containing special characters in the redirect target', async () => {
    const res = await GET(
      makeRequest('https://example.com/api/team-members?groupId=' + encodeURIComponent('grp/ 1')),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://example.com/api/team-members/group/grp%2F%201',
    );
  });
});
