import { NotFoundError, toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { ListTeamMembersFilter, TeamMemberRepository } from './team-member.repository';
import type { AuditContext, TeamMember, TeamMemberStats } from './team-member.types';
import type { CreateTeamMemberInput, UpdateTeamMemberInput } from './team-member.schema';

export type TeamMemberServiceDeps = {
  repository: TeamMemberRepository;
  logger?: Logger;
};

export interface TeamMemberService {
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

  return {
    async list(filter) {
      try {
        return ok(await repository.list(filter));
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async stats() {
      try {
        return ok(await repository.stats());
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async create(input, actor) {
      try {
        const audit: AuditContext = { actor, action: 'team_member.create' };
        const created = await repository.createWithAudit({ data: input, audit });
        log.info('team_member_created', { id: created.id, actor });
        return ok(created);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async update(id, input, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Team member not found.'));

        const audit: AuditContext = { actor, action: 'team_member.update' };
        const updated = await repository.updateWithAudit({ id, data: input, audit });
        log.info('team_member_updated', { id, actor });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async remove(id, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Team member not found.'));

        const audit: AuditContext = { actor, action: 'team_member.delete' };
        await repository.deleteWithAudit({ id, audit });
        log.info('team_member_deleted', { id, actor });
        return ok(existing);
      } catch (error) {
        return err(toAppError(error));
      }
    },
  };
}
