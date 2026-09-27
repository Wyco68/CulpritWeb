// research-groups module — the lab's team members (ADR-016) and the admin-defined teams they are
// listed under (ADR-020). The name predates the removal of research groups and is kept so imports
// did not all have to move; every member has a profile page, and the director is the member
// flagged `isDirector`.

export {
  createTeamMemberSchema,
  updateTeamMemberSchema,
  hiddenSectionsSchema,
  type CreateTeamMemberInput,
  type UpdateTeamMemberInput,
  type MemberLinkInput,
} from './team-member.schema';

export type {
  TeamMember,
  TeamMemberProfile,
  TeamMemberStats,
  MemberLink,
  AuditContext,
} from './team-member.types';

export {
  createTeamSchema,
  updateTeamSchema,
  type CreateTeamInput,
  type UpdateTeamInput,
} from './team.schema';
export type { Team, TeamRef } from './team.types';
export { createTeamService, type TeamService, type TeamServiceDeps } from './team.service';
export type { TeamRepository } from './team.repository';

// The profile-section vocabulary lives in shared (the teaching module's labels mirror it, so
// neither module can own it) and is re-exported here as part of this module's public surface.
export {
  PROFILE_SECTIONS,
  PROFILE_SECTION_LABELS,
  showsSection,
  type ProfileSection,
} from '@/modules/shared/lib/profile-sections';

export { groupMembers, type MemberGroup } from './team-grouping';

export {
  createTeamMemberService,
  type TeamMemberService,
  type TeamMemberServiceDeps,
  type MemberCvDirectory,
  type MemberProjectDirectory,
} from './team-member.service';

export type { TeamMemberRepository } from './team-member.repository';

export { matchMember, isMemberByline, bylineSuggestions, type BylineMember } from './byline-match';

export { getTeamMemberService, getTeamService } from './container';

export { TeamMembersView, TeamMemberCard, memberInitials } from './ui/team-members-view';
export { MemberCard } from './ui/member-card';
export { BylineNames } from './ui/byline-names';
export { CreditedWorkList, type CreditedWork } from './ui/credited-works';
export { TeamMembersTable } from './ui/team-members-table';
export { TeamsAdmin } from './ui/teams-admin';
