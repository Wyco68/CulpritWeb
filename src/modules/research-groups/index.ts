// research-groups module — groups + CV-style team members (researchers & visiting professors).
// Team members are the closely-related, FK'd entity and live here too (research-group.* / team-member.*).

export {
  createResearchGroupSchema,
  updateResearchGroupSchema,
  researchGroupIdSchema,
  type CreateResearchGroupInput,
  type UpdateResearchGroupInput,
} from './research-group.schema';

export type { ResearchGroup, AuditContext } from './research-group.types';

export {
  createResearchGroupService,
  type ResearchGroupService,
  type ResearchGroupServiceDeps,
} from './research-group.service';

export type { ResearchGroupRepository } from './research-group.repository';

export {
  createTeamMemberSchema,
  updateTeamMemberSchema,
  teamMemberIdSchema,
  listTeamMembersQuerySchema,
  type CreateTeamMemberInput,
  type UpdateTeamMemberInput,
  type ListTeamMembersQuery,
} from './team-member.schema';

export type { TeamMember } from './team-member.types';

export {
  createTeamMemberService,
  type TeamMemberService,
  type TeamMemberServiceDeps,
} from './team-member.service';

export type { TeamMemberRepository, ListTeamMembersFilter } from './team-member.repository';

export { getResearchGroupService, getTeamMemberService } from './container';

export { TeamMembersView } from './ui/team-members-view';
export { ResearchGroupsTable } from './ui/research-groups-table';
export { TeamMembersTable } from './ui/team-members-table';
