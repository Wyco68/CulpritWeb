import { describe, expect, it } from 'vitest';
import {
  createTeamMemberSchema,
  listTeamMembersQuerySchema,
  updateTeamMemberSchema,
} from '../team-member.schema';

describe('createTeamMemberSchema', () => {
  it('parses a valid team member without a group', () => {
    const result = createTeamMemberSchema.safeParse({
      name: 'Jane Doe',
      role: 'PhD Candidate',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.researchGroupId).toBeUndefined();
  });

  it('parses a valid team member with a group', () => {
    const result = createTeamMemberSchema.safeParse({
      name: 'Jane Doe',
      role: 'Visiting Professor',
      bio: 'Works on network security.',
      photoUrl: 'https://example.com/jane.jpg',
      researchGroupId: 'group_1',
      sortOrder: 3,
    });
    expect(result.success).toBe(true);
  });

  it('requires name and role', () => {
    const result = createTeamMemberSchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;
    const fieldErrors = result.error.flatten().fieldErrors;
    expect(fieldErrors.name).toBeDefined();
    expect(fieldErrors.role).toBeDefined();
  });

  it('allows researchGroupId to be explicitly null (detach from group)', () => {
    const result = updateTeamMemberSchema.safeParse({ researchGroupId: null });
    expect(result.success).toBe(true);
  });
});

describe('listTeamMembersQuerySchema', () => {
  it('accepts an empty query', () => {
    expect(listTeamMembersQuerySchema.safeParse({}).success).toBe(true);
  });

  it('accepts a groupId filter', () => {
    const result = listTeamMembersQuerySchema.safeParse({ groupId: 'group_1' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.groupId).toBe('group_1');
  });
});
