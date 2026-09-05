import { NotFoundError } from '@/modules/shared/lib/errors';
import { attempt, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { CvEntryRepository } from './cv-entry.repository';
import type { CourseRepository } from './course.repository';
import type { Course, CourseStats, CvEntry, CvEntryStats, CvSection } from './teaching.types';
import type {
  CreateCourseInput,
  CreateCvEntryInput,
  UpdateCourseInput,
  UpdateCvEntryInput,
} from './teaching.schema';

// Business layer for the About and Teaching tabs. Courses and CV entries are plain published
// content — no status, no lifecycle, nothing that can return 409 — so the services are thin:
// existence checks, audit context, structured logging, errors on the Result channel.

export type CvEntryServiceDeps = {
  repository: CvEntryRepository;
  logger?: Logger;
};

export interface CvEntryService {
  list(): Promise<Result<CvEntry[]>>;
  /** Headline counts for the dashboard, aggregated in SQL. */
  stats(): Promise<Result<CvEntryStats>>;
  listBySections(sections: readonly CvSection[]): Promise<Result<CvEntry[]>>;
  create(input: CreateCvEntryInput, actor: string): Promise<Result<CvEntry>>;
  update(id: string, input: UpdateCvEntryInput, actor: string): Promise<Result<CvEntry>>;
  /** Returns the removed record (pre-delete snapshot) for confirmation. */
  remove(id: string, actor: string): Promise<Result<CvEntry>>;
}

export function createCvEntryService(deps: CvEntryServiceDeps): CvEntryService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  async function requireExisting(id: string): Promise<CvEntry> {
    const existing = await repository.findById(id);
    if (!existing) throw new NotFoundError('Entry not found.');
    return existing;
  }

  return {
    list: () => attempt(() => repository.list()),

    listBySections: (sections) => attempt(() => repository.listBySections(sections)),

    stats: () => attempt(() => repository.stats()),

    create: (input, actor) =>
      attempt(async () => {
        const created = await repository.createWithAudit({
          data: input,
          audit: { actor, action: 'cv_entry.create' },
        });
        log.info('cv_entry_created', { id: created.id, section: created.section, actor });
        return created;
      }),

    update: (id, input, actor) =>
      attempt(async () => {
        await requireExisting(id);
        const updated = await repository.updateWithAudit({
          id,
          data: input,
          audit: { actor, action: 'cv_entry.update' },
        });
        log.info('cv_entry_updated', { id, actor });
        return updated;
      }),

    remove: (id, actor) =>
      attempt(async () => {
        const existing = await requireExisting(id);
        // The before-state goes into the audit entry inside the delete transaction. A CV line is
        // typed by hand and has no other copy once the row is gone.
        await repository.deleteWithAudit({
          id,
          audit: {
            actor,
            action: 'cv_entry.delete',
            metadata: {
              section: existing.section,
              title: existing.title,
              subtitle: existing.subtitle,
              year: existing.year,
              description: existing.description,
            },
          },
        });
        log.info('cv_entry_deleted', { id, actor });
        return existing;
      }),
  };
}

export type CourseServiceDeps = {
  repository: CourseRepository;
  logger?: Logger;
};

export interface CourseService {
  list(): Promise<Result<Course[]>>;
  /** Headline counts for the dashboard, aggregated in SQL. */
  stats(): Promise<Result<CourseStats>>;
  create(input: CreateCourseInput, actor: string): Promise<Result<Course>>;
  update(id: string, input: UpdateCourseInput, actor: string): Promise<Result<Course>>;
  remove(id: string, actor: string): Promise<Result<Course>>;
}

export function createCourseService(deps: CourseServiceDeps): CourseService {
  const { repository } = deps;
  const log = deps.logger ?? defaultLogger;

  async function requireExisting(id: string): Promise<Course> {
    const existing = await repository.findById(id);
    if (!existing) throw new NotFoundError('Course not found.');
    return existing;
  }

  return {
    list: () => attempt(() => repository.list()),

    stats: () => attempt(() => repository.stats()),

    create: (input, actor) =>
      attempt(async () => {
        const created = await repository.createWithAudit({
          data: input,
          audit: { actor, action: 'course.create' },
        });
        log.info('course_created', { id: created.id, actor });
        return created;
      }),

    update: (id, input, actor) =>
      attempt(async () => {
        await requireExisting(id);
        const updated = await repository.updateWithAudit({
          id,
          data: input,
          audit: { actor, action: 'course.update' },
        });
        log.info('course_updated', { id, actor });
        return updated;
      }),

    remove: (id, actor) =>
      attempt(async () => {
        const existing = await requireExisting(id);
        await repository.deleteWithAudit({
          id,
          audit: {
            actor,
            action: 'course.delete',
            metadata: {
              code: existing.code,
              title: existing.title,
              level: existing.level,
              term: existing.term,
            },
          },
        });
        log.info('course_deleted', { id, actor });
        return existing;
      }),
  };
}

/**
 * Groups entries under their section heading, in the order the caller asked for the sections.
 * Empty sections are dropped — a heading with nothing under it is noise on a public page.
 */
export function groupBySection(
  entries: CvEntry[],
  sections: readonly CvSection[],
): { section: CvSection; entries: CvEntry[] }[] {
  return sections
    .map((section) => ({ section, entries: entries.filter((entry) => entry.section === section) }))
    .filter((group) => group.entries.length > 0);
}

/**
 * Groups courses by `level`, keeping the admin's own ordering: the service returns rows by
 * `sortOrder`, so the first time a level appears fixes its position. Sorting levels alphabetically
 * would silently override the sequence the admin arranged — same reasoning as the Research index.
 */
export function groupByLevel(courses: Course[]): { level: string; courses: Course[] }[] {
  const groups = new Map<string, Course[]>();
  for (const course of courses) {
    const existing = groups.get(course.level);
    if (existing) existing.push(course);
    else groups.set(course.level, [course]);
  }
  return [...groups].map(([level, grouped]) => ({ level, courses: grouped }));
}
