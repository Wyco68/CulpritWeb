import { NotFoundError } from '@/modules/shared/lib/errors';
import { attempt, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { ResearchGroupRepository } from './research-group.repository';
import type { ResearchGroup, ResearchGroupSummary } from './research-group.types';
import type { CreateResearchGroupInput, UpdateResearchGroupInput } from './research-group.schema';

export type ResearchGroupServiceDeps = {
  repository: ResearchGroupRepository;
  logger?: Logger;
};

export interface ResearchGroupService {
  list(): Promise<Result<ResearchGroup[]>>;
  /** Groups with a member count instead of the member rows — for screens that render group size. */
  listWithMemberCounts(): Promise<Result<ResearchGroupSummary[]>>;
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

  async function requireExisting(id: string): Promise<ResearchGroup> {
    const existing = await repository.findById(id);
    if (!existing) throw new NotFoundError('Research group not found.');
    return existing;
  }

  return {
    list: () => attempt(() => repository.list()),

    listWithMemberCounts: () => attempt(() => repository.listWithMemberCounts()),

    create: (input, actor) =>
      attempt(async () => {
        const created = await repository.createWithAudit({
          data: input,
          audit: { actor, action: 'research_group.create' },
        });
        log.info('research_group_created', { id: created.id, actor });
        return created;
      }),

    update: (id, input, actor) =>
      attempt(async () => {
        await requireExisting(id);
        const updated = await repository.updateWithAudit({
          id,
          data: input,
          audit: { actor, action: 'research_group.update' },
        });
        log.info('research_group_updated', { id, actor });
        return updated;
      }),

    remove: (id, actor) =>
      attempt(async () => {
        const existing = await requireExisting(id);
        await repository.deleteWithAudit({ id, audit: { actor, action: 'research_group.delete' } });
        log.info('research_group_deleted', { id, actor });
        return existing;
      }),
  };
}
