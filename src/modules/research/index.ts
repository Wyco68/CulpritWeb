// research module — research works CRUD (title, summary, area, contributors, sortOrder).

export {
  createResearchSchema,
  updateResearchSchema,
  type CreateResearchInput,
  type UpdateResearchInput,
} from './research.schema';

export type { Research, ResearchContributor, ResearchStats, AuditContext } from './research.types';

export {
  createResearchService,
  type ResearchService,
  type ResearchServiceDeps,
} from './research.service';

export type { ResearchRepository } from './research.repository';

export { getResearchService } from './container';

export { ResearchList } from './ui/research-list';

// Admin UI is NOT re-exported here — admin pages import it by path. Public pages import this barrel
// for its services, and Next ships every client component reachable from a page's imports, used or
// not: re-exporting an admin table here put it (and its zod form schema) on every public page.
