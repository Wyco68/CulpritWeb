import { NotFoundError, ValidationError } from '@/modules/shared/lib/errors';
import { attempt, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { TeamRepository } from './team.repository';
import type { Team } from './team.types';
import type { CreateTeamInput, UpdateTeamInput } from './team.schema';

// Admin-defined teams (ADR-020): a name and a position on the public Team tab. The only rule is
// that two teams cannot share a name — the public page would show two identical headings.

export type TeamServiceDeps = { repository: TeamRepository; logger?: Logger };

export interface TeamService {
  /** In display order, each with its member count. */
  list(): Promise<Result<Team[]>>;
  create(input: CreateTeamInput, actor: string): Promise<Result<Team>>;
  update(id: string, input: UpdateTeamInput, actor: string): Promise<Result<Team>>;
  /** Returns the removed team. Its members stay, with no team. */
  remove(id: string, actor: string): Promise<Result<Team>>;
}

export function createTeamService(deps: TeamServiceDeps): TeamService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  async function requireExisting(id: string): Promise<Team> {
    const existing = await repository.findById(id);
    if (!existing) throw new NotFoundError('Team not found.');
    return existing;
  }

  /** A 400 with a field error rather than the unique index's 500. */
  async function requireUniqueName(name: string, exceptId?: string): Promise<void> {
    const clash = await repository.findByName(name);
    if (clash && clash.id !== exceptId) {
      throw new ValidationError('A team with this name already exists.', {
        name: ['A team with this name already exists.'],
      });
    }
  }

  return {
    list: () => attempt(() => repository.list()),

    create: (input, actor) =>
      attempt(async () => {
        await requireUniqueName(input.name);
        const created = await repository.createWithAudit({
          data: input,
          audit: { actor, action: 'team.create' },
        });
        log.info('team_created', { id: created.id, actor });
        return created;
      }),

    update: (id, input, actor) =>
      attempt(async () => {
        await requireExisting(id);
        if (input.name !== undefined) await requireUniqueName(input.name, id);
        const updated = await repository.updateWithAudit({
          id,
          data: input,
          audit: { actor, action: 'team.update' },
        });
        log.info('team_updated', { id, actor });
        return updated;
      }),

    remove: (id, actor) =>
      attempt(async () => {
        const existing = await requireExisting(id);
        await repository.deleteWithAudit({
          id,
          audit: {
            actor,
            action: 'team.delete',
            metadata: { name: existing.name, memberCount: existing.memberCount },
          },
        });
        log.info('team_deleted', { id, actor });
        return existing;
      }),
  };
}
