import { NotFoundError, toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { PublicationRepository } from './publication.repository';
import type { AuditContext, Publication } from './publication.types';
import type { CreatePublicationInput, UpdatePublicationInput } from './publication.schema';

export type PublicationServiceDeps = {
  repository: PublicationRepository;
  logger?: Logger;
};

export interface PublicationService {
  list(): Promise<Result<Publication[]>>;
  create(input: CreatePublicationInput, actor: string): Promise<Result<Publication>>;
  update(id: string, input: UpdatePublicationInput, actor: string): Promise<Result<Publication>>;
  /** Returns the removed record (pre-delete snapshot) for confirmation. */
  remove(id: string, actor: string): Promise<Result<Publication>>;
}

export function createPublicationService(deps: PublicationServiceDeps): PublicationService {
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
        const audit: AuditContext = { actor, action: 'publication.create' };
        const created = await repository.createWithAudit({ data: input, audit });
        log.info('publication_created', { id: created.id, actor });
        return ok(created);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async update(id, input, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Publication not found.'));

        const audit: AuditContext = { actor, action: 'publication.update' };
        const updated = await repository.updateWithAudit({ id, data: input, audit });
        log.info('publication_updated', { id, actor });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async remove(id, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Publication not found.'));

        const audit: AuditContext = { actor, action: 'publication.delete' };
        await repository.deleteWithAudit({ id, audit });
        log.info('publication_deleted', { id, actor });
        return ok(existing);
      } catch (error) {
        return err(toAppError(error));
      }
    },
  };
}
