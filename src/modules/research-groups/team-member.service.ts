import { NotFoundError, ValidationError } from '@/modules/shared/lib/errors';
import { attempt, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import { showsSection } from '@/modules/shared/lib/profile-sections';
import type { Course, CvEntry } from '@/modules/teaching';
import type { Project } from '@/modules/projects';
import type { TeamMemberRepository } from './team-member.repository';
import type {
  MemberLink,
  TeamMember,
  TeamMemberProfile,
  TeamMemberStats,
} from './team-member.types';
import type { CreateTeamMemberInput, UpdateTeamMemberInput } from './team-member.schema';
import type { TeamRepository } from './team.repository';

/**
 * Port onto the teaching module's per-member reads. Injected rather than imported so this service
 * never reaches into another module's repository, and so `findProfile` is testable without a
 * database. Wired to the teaching services in `container.ts`. Both reads throw on failure; the
 * service runs inside `attempt()`, which maps a throw onto the Result channel.
 */
export interface MemberCvDirectory {
  cvEntriesFor(teamMemberId: string): Promise<CvEntry[]>;
  coursesFor(teamMemberId: string): Promise<Course[]>;
}

/** The same port pattern onto the projects module's per-member read. */
export interface MemberProjectDirectory {
  projectsFor(teamMemberId: string): Promise<Project[]>;
}

export type TeamMemberServiceDeps = {
  repository: TeamMemberRepository;
  /** To check a `teamId` names a real team before the foreign key does, less helpfully. */
  teams: Pick<TeamRepository, 'findById'>;
  cv: MemberCvDirectory;
  projects: MemberProjectDirectory;
  logger?: Logger;
};

export interface TeamMemberService {
  /** One member by id, or null. */
  findById(id: string): Promise<Result<TeamMember | null>>;
  /** Everything the member's public profile page renders, or null when the id is unknown. */
  findProfile(id: string): Promise<Result<TeamMemberProfile | null>>;
  /** The director's profile, or null when no member is flagged director. */
  findDirectorProfile(): Promise<Result<TeamMemberProfile | null>>;
  /** Every member, the director first, then by sortOrder. Group them with `groupMembers`. */
  list(): Promise<Result<TeamMember[]>>;
  /** One member's external links, in the admin's arrangement. */
  listLinks(teamMemberId: string): Promise<Result<MemberLink[]>>;
  /** Several members' links in one query, keyed by member id. */
  listLinksForMembers(teamMemberIds: string[]): Promise<Result<Record<string, MemberLink[]>>>;
  /** Headline counts for the dashboard, aggregated in SQL. */
  stats(): Promise<Result<TeamMemberStats>>;
  create(input: CreateTeamMemberInput, actor: string): Promise<Result<TeamMember>>;
  update(id: string, input: UpdateTeamMemberInput, actor: string): Promise<Result<TeamMember>>;
  /** Returns the removed record (pre-delete snapshot) for confirmation. */
  remove(id: string, actor: string): Promise<Result<TeamMember>>;
}

export function createTeamMemberService(deps: TeamMemberServiceDeps): TeamMemberService {
  const { repository, teams, cv, projects } = deps;
  const log = deps.logger ?? defaultLogger;

  async function requireExisting(id: string): Promise<TeamMember> {
    const existing = await repository.findById(id);
    if (!existing) throw new NotFoundError('Team member not found.');
    return existing;
  }

  /** A 400 on the field rather than a foreign-key 500 when the team was deleted meanwhile. */
  async function requireTeam(teamId: string | null | undefined): Promise<void> {
    if (!teamId) return;
    if (!(await teams.findById(teamId))) {
      throw new ValidationError('That team no longer exists.', { teamId: ['Choose a team.'] });
    }
  }

  /**
   * Assembles the profile, less the sections the admin has hidden for this member (ADR-020).
   *
   * All five reads fire in a single wave — `findById` included — rather than waiting to learn which
   * sections are hidden before deciding what else to ask for; the hidden ones are filtered out
   * afterwards. Hidden rows are never deleted: switching a section back on restores them.
   *
   * `known`, when passed, is a row the caller already has in hand (`findDirectorProfile` gets it
   * from `list()`) — passing it fills the member slot with an already-resolved value instead of
   * firing a redundant `findById` inside the same wave.
   */
  async function profileOf(id: string, known?: TeamMember): Promise<TeamMemberProfile | null> {
    const [member, links, cvEntries, courses, memberProjects] = await Promise.all([
      known ? Promise.resolve(known) : repository.findById(id),
      repository.listLinks(id),
      cv.cvEntriesFor(id),
      cv.coursesFor(id),
      projects.projectsFor(id),
    ]);
    if (!member) return null;
    return {
      member,
      links,
      cvEntries: cvEntries.filter((entry) => showsSection(member, entry.section)),
      courses: showsSection(member, 'courses') ? courses : [],
      projects: showsSection(member, 'projects') ? memberProjects : [],
    };
  }

  return {
    findById: (id) => attempt(() => repository.findById(id)),

    findProfile: (id) => attempt(() => profileOf(id)),

    findDirectorProfile: () =>
      attempt(async () => {
        // The list is already ordered director-first and is a handful of rows.
        const [first] = await repository.list();
        return first?.isDirector ? profileOf(first.id, first) : null;
      }),

    list: () => attempt(() => repository.list()),

    listLinks: (teamMemberId) => attempt(() => repository.listLinks(teamMemberId)),

    listLinksForMembers: (teamMemberIds) =>
      attempt(() => repository.listLinksForMembers(teamMemberIds)),

    stats: () => attempt(() => repository.stats()),

    create: (input, actor) =>
      attempt(async () => {
        await requireTeam(input.teamId);
        // The repository clears `isDirector` on every other member inside the same transaction.
        const created = await repository.createWithAudit({
          data: input,
          audit: { actor, action: 'team_member.create' },
        });
        log.info('team_member_created', {
          id: created.id,
          actor,
          teamId: created.team?.id ?? null,
          isDirector: created.isDirector,
        });
        return created;
      }),

    update: (id, input, actor) =>
      attempt(async () => {
        await requireExisting(id);
        await requireTeam(input.teamId);
        const updated = await repository.updateWithAudit({
          id,
          data: input,
          audit: { actor, action: 'team_member.update' },
        });
        log.info('team_member_updated', { id, actor, teamId: updated.team?.id ?? null });
        return updated;
      }),

    remove: (id, actor) =>
      attempt(async () => {
        const existing = await requireExisting(id);
        // Their CV entries, courses, projects and links cascade with them, so the before-state goes
        // into the audit entry: a hand-typed profile has no other copy once the row is gone.
        await repository.deleteWithAudit({
          id,
          audit: {
            actor,
            action: 'team_member.delete',
            metadata: {
              name: existing.name,
              citationName: existing.citationName,
              role: existing.role,
              affiliation: existing.affiliation,
              team: existing.team?.name ?? null,
              hiddenSections: existing.hiddenSections,
              isDirector: existing.isDirector,
            },
          },
        });
        log.info('team_member_deleted', { id, actor });
        return existing;
      }),
  };
}
