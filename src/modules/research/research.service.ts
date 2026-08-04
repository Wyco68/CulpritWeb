import { NotFoundError, toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { ResearchRepository } from './research.repository';
import type { AuditContext, Research } from './research.types';
import type { CreateResearchInput, UpdateResearchInput } from './research.schema';

export type ResearchServiceDeps = {
  repository: ResearchRepository;
  logger?: Logger;
};

export interface ResearchService {
  list(): Promise<Result<Research[]>>;
  create(input: CreateResearchInput, actor: string): Promise<Result<Research>>;
  update(id: string, input: UpdateResearchInput, actor: string): Promise<Result<Research>>;
  /** Returns the removed record (pre-delete snapshot) for confirmation. */
  remove(id: string, actor: string): Promise<Result<Research>>;
}

export function createResearchService(deps: ResearchServiceDeps): ResearchService {
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
        const audit: AuditContext = { actor, action: 'research.create' };
        const created = await repository.createWithAudit({ data: input, audit });
        log.info('research_created', { id: created.id, actor });
        return ok(created);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async update(id, input, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Research work not found.'));

        const audit: AuditContext = { actor, action: 'research.update' };
        const updated = await repository.updateWithAudit({ id, data: input, audit });
        log.info('research_updated', { id, actor });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async remove(id, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Research work not found.'));

        const audit: AuditContext = { actor, action: 'research.delete' };
        await repository.deleteWithAudit({ id, audit });
        log.info('research_deleted', { id, actor });
        return ok(existing);
      } catch (error) {
        return err(toAppError(error));
      }
    },
  };
}
