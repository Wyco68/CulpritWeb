import { NotFoundError } from '@/modules/shared/lib/errors';
import { attempt, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { ResearchRepository } from './research.repository';
import type { Research, ResearchStats } from './research.types';
import type { CreateResearchInput, UpdateResearchInput } from './research.schema';

export type ResearchServiceDeps = {
  repository: ResearchRepository;
  logger?: Logger;
};

export interface ResearchService {
  list(): Promise<Result<Research[]>>;
  /** Headline counts for the dashboard, aggregated in SQL. */
  stats(): Promise<Result<ResearchStats>>;
  create(input: CreateResearchInput, actor: string): Promise<Result<Research>>;
  update(id: string, input: UpdateResearchInput, actor: string): Promise<Result<Research>>;
  /** Returns the removed record (pre-delete snapshot) for confirmation. */
  remove(id: string, actor: string): Promise<Result<Research>>;
}

export function createResearchService(deps: ResearchServiceDeps): ResearchService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  async function requireExisting(id: string): Promise<Research> {
    const existing = await repository.findById(id);
    if (!existing) throw new NotFoundError('Research work not found.');
    return existing;
  }

  return {
    list: () => attempt(() => repository.list()),

    stats: () => attempt(() => repository.stats()),

    create: (input, actor) =>
      attempt(async () => {
        const created = await repository.createWithAudit({
          data: input,
          audit: { actor, action: 'research.create' },
        });
        log.info('research_created', { id: created.id, actor });
        return created;
      }),

    update: (id, input, actor) =>
      attempt(async () => {
        await requireExisting(id);
        const updated = await repository.updateWithAudit({
          id,
          data: input,
          audit: { actor, action: 'research.update' },
        });
        log.info('research_updated', { id, actor });
        return updated;
      }),

    remove: (id, actor) =>
      attempt(async () => {
        const existing = await requireExisting(id);
        await repository.deleteWithAudit({ id, audit: { actor, action: 'research.delete' } });
        log.info('research_deleted', { id, actor });
        return existing;
      }),
  };
}
