import { CV_SECTION_LABELS, type CvEntry, type CvSection } from '../teaching.types';

// Renders grouped CV entries under their section headings. Used by both public tabs — About for
// education/fellowships/scholarships/interests/talks, Teaching for roles/awards — because the
// entries are the same shape wherever they appear.
//
// Visually this is exactly what `ProfileAffiliations` used to draw, kept deliberately unchanged
// when the data moved out of Json columns: a single stacked column, never a two-column grid. These
// sections hold entries of wildly different lengths (two awards next to seven fellowships), and
// side-by-side columns left the eye with no reliable cue for where one section ended and the next
// began. Each section opens with a full-width rule, so the boundaries are unambiguous at any width.
//
// Section headings are set in the serif at reading size, not as uppercase letter-spaced labels —
// all-caps removes the word-shape cue that fluent reading depends on. They carry the accent and a
// heavier weight so the boundary between one list and the next is legible at a glance, which is
// the job the column rules used to do before this ran as a single column.
//
// Contrast: --accent measures 4.61:1 on the page ground, clearing the 4.5:1 AA threshold for
// normal-size text — so this holds up even though the heading is also large-text by WCAG's
// definition, where the bar is only 3:1.

/**
 * The `id` a CV section is reachable at from the in-page section nav — `/teaching#teaching-role`.
 * Exported so the pages that build the jump list and the component that renders the targets stay
 * in step; underscores become hyphens because the section key is a database value and the id is a
 * URL people can be given.
 */
export function cvSectionAnchorId(section: CvSection): string {
  return section.replace(/_/g, '-');
}

function Section({ section, entries }: { section: CvSection; entries: CvEntry[] }) {
  const headingId = `cv-section-${section}`;

  return (
    <section
      id={cvSectionAnchorId(section)}
      aria-labelledby={headingId}
      className="break-inside-avoid border-t border-border pt-8 first:border-t-0 first:pt-0"
    >
      <h3 id={headingId} className="font-serif text-xl font-semibold text-accent">
        {CV_SECTION_LABELS[section]}
      </h3>

      <ul className="mt-5 space-y-5">
        {entries.map((entry) => (
          <li key={entry.id} className="text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              {/* `min-w-0` + `break-words`: a title can be an unbroken string the admin pasted
                  (a DOI, a URL-shaped award name). Without both, the flex item refuses to shrink
                  below its content and pushes the year off the row. */}
              <span className="min-w-0 text-pretty break-words font-medium leading-snug text-foreground">
                {entry.title}
              </span>
              {/* Tabular figures so the year column stays in a straight line down the list
                  instead of ragging with each entry's digit widths. */}
              {entry.year && (
                <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">
                  {entry.year}
                </span>
              )}
            </div>
            {entry.subtitle && (
              <p className="mt-0.5 max-w-[62ch] text-pretty break-words leading-relaxed text-muted-foreground">
                {entry.subtitle}
              </p>
            )}
            {entry.description && (
              <p className="mt-1 max-w-[62ch] text-pretty break-words leading-relaxed text-muted-foreground">
                {entry.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CvEntryList({ groups }: { groups: { section: CvSection; entries: CvEntry[] }[] }) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <Section key={group.section} section={group.section} entries={group.entries} />
      ))}
    </div>
  );
}
