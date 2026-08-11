import { describe, expect, it } from 'vitest';
import {
  createTeamMemberSchema,
  teamMemberGroupIdSchema,
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

describe('teamMemberGroupIdSchema', () => {
  it('accepts a non-empty groupId', () => {
    const result = teamMemberGroupIdSchema.safeParse('group_1');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('group_1');
  });

  it('rejects an empty groupId', () => {
    expect(teamMemberGroupIdSchema.safeParse('').success).toBe(false);
  });

  it('rejects a groupId over 200 characters', () => {
    expect(teamMemberGroupIdSchema.safeParse('g'.repeat(201)).success).toBe(false);
  });
});
