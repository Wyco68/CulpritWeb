import { NotFoundError } from '@/modules/shared/lib/errors';
import { attempt, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { ListTeamMembersFilter, TeamMemberRepository } from './team-member.repository';
import type { TeamMember, TeamMemberStats } from './team-member.types';
import type { CreateTeamMemberInput, UpdateTeamMemberInput } from './team-member.schema';

export type TeamMemberServiceDeps = {
  repository: TeamMemberRepository;
  logger?: Logger;
};

export interface TeamMemberService {
  /** One member by id. Exists so callers that need a single person don't list the whole table. */
  findById(id: string): Promise<Result<TeamMember | null>>;
  list(filter?: ListTeamMembersFilter): Promise<Result<TeamMember[]>>;
  /** Headline counts for the dashboard, aggregated in SQL. */
  stats(): Promise<Result<TeamMemberStats>>;
  create(input: CreateTeamMemberInput, actor: string): Promise<Result<TeamMember>>;
  update(id: string, input: UpdateTeamMemberInput, actor: string): Promise<Result<TeamMember>>;
  /** Returns the removed record (pre-delete snapshot) for confirmation. */
  remove(id: string, actor: string): Promise<Result<TeamMember>>;
}

export function createTeamMemberService(deps: TeamMemberServiceDeps): TeamMemberService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  async function requireExisting(id: string): Promise<TeamMember> {
    const existing = await repository.findById(id);
    if (!existing) throw new NotFoundError('Team member not found.');
    return existing;
  }

  return {
    findById: (id) => attempt(() => repository.findById(id)),

    list: (filter) => attempt(() => repository.list(filter)),

    stats: () => attempt(() => repository.stats()),

    create: (input, actor) =>
      attempt(async () => {
        const created = await repository.createWithAudit({
          data: input,
          audit: { actor, action: 'team_member.create' },
        });
        log.info('team_member_created', { id: created.id, actor });
        return created;
      }),

    update: (id, input, actor) =>
      attempt(async () => {
        await requireExisting(id);
        const updated = await repository.updateWithAudit({
          id,
          data: input,
          audit: { actor, action: 'team_member.update' },
        });
        log.info('team_member_updated', { id, actor });
        return updated;
      }),

    remove: (id, actor) =>
      attempt(async () => {
        const existing = await requireExisting(id);
        await repository.deleteWithAudit({ id, audit: { actor, action: 'team_member.delete' } });
        log.info('team_member_deleted', { id, actor });
        return existing;
      }),
  };
}
