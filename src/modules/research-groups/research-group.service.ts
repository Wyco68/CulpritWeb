import { NotFoundError, toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { ResearchGroupRepository } from './research-group.repository';
import type { AuditContext, ResearchGroup } from './research-group.types';
import type { CreateResearchGroupInput, UpdateResearchGroupInput } from './research-group.schema';

export type ResearchGroupServiceDeps = {
  repository: ResearchGroupRepository;
  logger?: Logger;
};

export interface ResearchGroupService {
  list(): Promise<Result<ResearchGroup[]>>;
  create(input: CreateResearchGroupInput, actor: string): Promise<Result<ResearchGroup>>;
  update(
    id: string,
    input: UpdateResearchGroupInput,
    actor: string,
  ): Promise<Result<ResearchGroup>>;
  /** Returns the removed record (pre-delete snapshot) for confirmation. */
  remove(id: string, actor: string): Promise<Result<ResearchGroup>>;
}

export function createResearchGroupService(deps: ResearchGroupServiceDeps): ResearchGroupService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  return {
    async list() {
      try {
        return ok(await repository.list());
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async create(input, actor) {
      try {
        const audit: AuditContext = { actor, action: 'research_group.create' };
        const created = await repository.createWithAudit({ data: input, audit });
        log.info('research_group_created', { id: created.id, actor });
        return ok(created);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async update(id, input, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Research group not found.'));

        const audit: AuditContext = { actor, action: 'research_group.update' };
        const updated = await repository.updateWithAudit({ id, data: input, audit });
        log.info('research_group_updated', { id, actor });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async remove(id, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Research group not found.'));

        const audit: AuditContext = { actor, action: 'research_group.delete' };
        await repository.deleteWithAudit({ id, audit });
        log.info('research_group_deleted', { id, actor });
        return ok(existing);
      } catch (error) {
        return err(toAppError(error));
      }
    },
  };
}
