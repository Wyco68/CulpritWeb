import { ArrowUpRight } from 'lucide-react';
import { panelClassName } from '@/modules/shared/ui/card';
import type { Course } from '../teaching.types';

// Courses grouped by level, using the same shape as the Research index: the grouping key sits in
// a left rail as a running head, entries in the reading column beside it. A visitor scans for
// "does this person teach undergraduates?" the same way they scan Research for an area, so the
// two tabs answer that question with the same layout rather than inventing a second one.
//
// Levels keep the admin's own ordering — the service returns rows by `sortOrder`, so the first
// time a level appears fixes its position. See `groupByLevel`.

export function CourseList({ groups }: { groups: { level: string; courses: Course[] }[] }) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group, groupIndex) => (
        <section
          key={group.level}
          aria-labelledby={`course-level-${groupIndex}`}
          style={{ '--i': groupIndex } as React.CSSProperties}
          className={`rise grid gap-x-6 ${panelClassName} sm:grid-cols-[11rem_1fr]`}
        >
          <h3
            id={`course-level-${groupIndex}`}
            className="mb-4 font-mono text-xs uppercase leading-5 tracking-[0.12em] text-accent sm:mb-0 sm:pt-1.5"
          >
            {group.level}
          </h3>

          <ul className="min-w-0">
            {group.courses.map((course) => (
              <li
                key={course.id}
                className="group border-t border-border/70 py-6 first:border-t-0 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h4 className="text-balance font-serif text-xl leading-snug text-foreground sm:text-2xl">
                    {/* The code is metadata about the course, not part of its name, so it sits in
                        the mono voice the rest of the site uses for reference numbers. */}
                    {course.code && (
                      <span className="mr-2.5 font-mono text-sm tracking-tight text-muted-foreground">
                        {course.code}
                      </span>
                    )}
                    {course.title}
                  </h4>
                  {course.term && (
                    <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">
                      {course.term}
                    </span>
                  )}
                </div>

                {course.description && (
                  <p className="mt-3 max-w-[62ch] text-pretty leading-[1.7] text-muted-foreground">
                    {course.description}
                  </p>
                )}

                {course.link && (
                  <a
                    href={course.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xs text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Course page
                    <ArrowUpRight
                      className="size-4 transition-[translate] duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
