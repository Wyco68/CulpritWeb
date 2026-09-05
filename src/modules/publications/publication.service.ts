import { NotFoundError } from '@/modules/shared/lib/errors';
import { attempt, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { PublicationRepository } from './publication.repository';
import type { Publication, PublicationStats } from './publication.types';
import type { CreatePublicationInput, UpdatePublicationInput } from './publication.schema';

export type PublicationServiceDeps = {
  repository: PublicationRepository;
  logger?: Logger;
};

export interface PublicationService {
  list(): Promise<Result<Publication[]>>;
  /** Headline counts for the dashboard, aggregated in SQL. */
  stats(): Promise<Result<PublicationStats>>;
  create(input: CreatePublicationInput, actor: string): Promise<Result<Publication>>;
  update(id: string, input: UpdatePublicationInput, actor: string): Promise<Result<Publication>>;
  /** Returns the removed record (pre-delete snapshot) for confirmation. */
  remove(id: string, actor: string): Promise<Result<Publication>>;
}

export function createPublicationService(deps: PublicationServiceDeps): PublicationService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  async function requireExisting(id: string): Promise<Publication> {
    const existing = await repository.findById(id);
    if (!existing) throw new NotFoundError('Publication not found.');
    return existing;
  }

  return {
    list: () => attempt(() => repository.list()),

    stats: () => attempt(() => repository.stats()),

    create: (input, actor) =>
      attempt(async () => {
        const created = await repository.createWithAudit({
          data: input,
          audit: { actor, action: 'publication.create' },
        });
        log.info('publication_created', { id: created.id, actor });
        return created;
      }),

    update: (id, input, actor) =>
      attempt(async () => {
        await requireExisting(id);
        const updated = await repository.updateWithAudit({
          id,
          data: input,
          audit: { actor, action: 'publication.update' },
        });
        log.info('publication_updated', { id, actor });
        return updated;
      }),

    remove: (id, actor) =>
      attempt(async () => {
        const existing = await requireExisting(id);
        await repository.deleteWithAudit({ id, audit: { actor, action: 'publication.delete' } });
        log.info('publication_deleted', { id, actor });
        return existing;
      }),
  };
}
