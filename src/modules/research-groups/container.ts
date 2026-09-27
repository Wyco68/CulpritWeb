import { getCourseService, getCvEntryService } from '@/modules/teaching';
import { getProjectService } from '@/modules/projects';
import { PrismaTeamMemberRepository } from './team-member.repository';
import { PrismaTeamRepository } from './team.repository';
import { createTeamService, type TeamService } from './team.service';
import {
  createTeamMemberService,
  type MemberCvDirectory,
  type MemberProjectDirectory,
  type TeamMemberService,
} from './team-member.service';

// Composition root: wires the Prisma-backed repositories and the teaching/projects modules'
// per-member reads into the services. Route handlers and Server Components call
// getTeamMemberService() / getTeamService() and nothing else.

const memberCv: MemberCvDirectory = {
  async cvEntriesFor(teamMemberId) {
    const result = await getCvEntryService().listForMember(teamMemberId);
    if (!result.ok) throw result.error;
    return result.data;
  },
  async coursesFor(teamMemberId) {
    const result = await getCourseService().listForMember(teamMemberId);
    if (!result.ok) throw result.error;
    return result.data;
  },
};

const memberProjects: MemberProjectDirectory = {
  async projectsFor(teamMemberId) {
    const result = await getProjectService().listForMember(teamMemberId);
    if (!result.ok) throw result.error;
    return result.data;
  },
};

const teamRepository = new PrismaTeamRepository();

let cached: TeamMemberService | undefined;
let cachedTeams: TeamService | undefined;

export function getTeamMemberService(): TeamMemberService {
  if (!cached) {
    cached = createTeamMemberService({
      repository: new PrismaTeamMemberRepository(),
      teams: teamRepository,
      cv: memberCv,
      projects: memberProjects,
    });
  }
  return cached;
}

export function getTeamService(): TeamService {
  if (!cachedTeams) cachedTeams = createTeamService({ repository: teamRepository });
  return cachedTeams;
}
