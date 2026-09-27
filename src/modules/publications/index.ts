// publications module — publications CRUD (title, credited authors, venue, year, link).

export {
  createPublicationSchema,
  updatePublicationSchema,
  type CreatePublicationInput,
  type UpdatePublicationInput,
} from './publication.schema';

export type {
  Publication,
  PublicationAuthor,
  PublicationStats,
  AuditContext,
} from './publication.types';

export {
  createPublicationService,
  type PublicationService,
  type PublicationServiceDeps,
} from './publication.service';

export type { PublicationRepository } from './publication.repository';

export { getPublicationService } from './container';

export { PublicationsList } from './ui/publications-list';

// Admin UI is NOT re-exported here — admin pages import it by path. Public pages import this barrel
// for its services, and Next ships every client component reachable from a page's imports, used or
// not: re-exporting an admin table here put it (and its zod form schema) on every public page.
