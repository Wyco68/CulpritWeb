import { NotFoundError, toAppError } from '@/modules/shared/lib/errors';
import { err, ok, type Result } from '@/modules/shared/lib/result';
import { logger as defaultLogger, type Logger } from '@/modules/shared/lib/logger';
import type { CvEntryRepository } from './cv-entry.repository';
import type { CourseRepository } from './course.repository';
import type {
  AuditContext,
  Course,
  CourseStats,
  CvEntry,
  CvEntryStats,
  CvSection,
} from './teaching.types';
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

  return {
    async list() {
      try {
        return ok(await repository.list());
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async listBySections(sections) {
      try {
        return ok(await repository.listBySections(sections));
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async stats() {
      try {
        return ok(await repository.stats());
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async create(input, actor) {
      try {
        const audit: AuditContext = { actor, action: 'cv_entry.create' };
        const created = await repository.createWithAudit({ data: input, audit });
        log.info('cv_entry_created', { id: created.id, section: created.section, actor });
        return ok(created);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async update(id, input, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Entry not found.'));

        const audit: AuditContext = { actor, action: 'cv_entry.update' };
        const updated = await repository.updateWithAudit({ id, data: input, audit });
        log.info('cv_entry_updated', { id, actor });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async remove(id, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Entry not found.'));

        // The before-state goes into the audit entry inside the delete transaction. A CV line is
        // typed by hand and has no other copy once the row is gone.
        const audit: AuditContext = {
          actor,
          action: 'cv_entry.delete',
          metadata: {
            section: existing.section,
            title: existing.title,
            subtitle: existing.subtitle,
            year: existing.year,
            description: existing.description,
          },
        };
        await repository.deleteWithAudit({ id, audit });
        log.info('cv_entry_deleted', { id, actor });
        return ok(existing);
      } catch (error) {
        return err(toAppError(error));
      }
    },
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

  return {
    async list() {
      try {
        return ok(await repository.list());
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async stats() {
      try {
        return ok(await repository.stats());
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async create(input, actor) {
      try {
        const audit: AuditContext = { actor, action: 'course.create' };
        const created = await repository.createWithAudit({ data: input, audit });
        log.info('course_created', { id: created.id, actor });
        return ok(created);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async update(id, input, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Course not found.'));

        const audit: AuditContext = { actor, action: 'course.update' };
        const updated = await repository.updateWithAudit({ id, data: input, audit });
        log.info('course_updated', { id, actor });
        return ok(updated);
      } catch (error) {
        return err(toAppError(error));
      }
    },

    async remove(id, actor) {
      try {
        const existing = await repository.findById(id);
        if (!existing) return err(new NotFoundError('Course not found.'));

        const audit: AuditContext = {
          actor,
          action: 'course.delete',
          metadata: {
            code: existing.code,
            title: existing.title,
            level: existing.level,
            term: existing.term,
          },
        };
        await repository.deleteWithAudit({ id, audit });
        log.info('course_deleted', { id, actor });
        return ok(existing);
      } catch (error) {
        return err(toAppError(error));
      }
    },
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
