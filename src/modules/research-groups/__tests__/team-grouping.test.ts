import { describe, expect, it } from 'vitest';
import { groupMembers } from '../team-grouping';
import type { TeamRef } from '../team.types';

// Pure layout of the public Team tab (ADR-020): the director on their own, then the admin's teams
// in their order, then anyone on no team.

const research: TeamRef = { id: 't-r', name: 'Research Team', sortOrder: 2 };
const dev: TeamRef = { id: 't-d', name: 'Development Team', sortOrder: 1 };
const alumni: TeamRef = { id: 't-a', name: 'Alumni', sortOrder: 1 };

const m = (id: string, team: TeamRef | null, isDirector = false) => ({ id, team, isDirector });

describe('groupMembers', () => {
  it('takes the director out of the teams, whatever team they are on', () => {
    const { director, groups } = groupMembers([m('d', research, true), m('r1', research)]);
    expect(director?.id).toBe('d');
    expect(groups).toEqual([{ team: research, members: [m('r1', research)] }]);
  });

  it('orders teams by position, then by name', () => {
    const { groups } = groupMembers([m('r1', research), m('d1', dev), m('a1', alumni)]);
    expect(groups.map((group) => group.team?.name)).toEqual([
      'Alumni',
      'Development Team',
      'Research Team',
    ]);
  });

  it('keeps the incoming member order inside a team', () => {
    const { groups } = groupMembers([m('r2', research), m('r1', research)]);
    expect(groups[0].members.map((member) => member.id)).toEqual(['r2', 'r1']);
  });

  it('lists members with no team last, and drops empty teams', () => {
    const { groups } = groupMembers([m('x', null), m('r1', research)]);
    expect(groups).toEqual([
      { team: research, members: [m('r1', research)] },
      { team: null, members: [m('x', null)] },
    ]);
  });

  it('has no director when nobody is flagged', () => {
    expect(groupMembers([m('r1', research)]).director).toBeNull();
  });
});
