import { PrismaResearchGroupRepository } from './research-group.repository';
import { createResearchGroupService, type ResearchGroupService } from './research-group.service';
import { PrismaTeamMemberRepository } from './team-member.repository';
import { createTeamMemberService, type TeamMemberService } from './team-member.service';

// Composition root: wires the Prisma-backed repositories into their services. Route handlers call
// getResearchGroupService() / getTeamMemberService() and nothing else.
let cachedGroup: ResearchGroupService | undefined;
let cachedMember: TeamMemberService | undefined;

export function getResearchGroupService(): ResearchGroupService {
  if (!cachedGroup) {
    cachedGroup = createResearchGroupService({ repository: new PrismaResearchGroupRepository() });
  }
  return cachedGroup;
}

export function getTeamMemberService(): TeamMemberService {
  if (!cachedMember) {
    cachedMember = createTeamMemberService({ repository: new PrismaTeamMemberRepository() });
  }
  return cachedMember;
}
