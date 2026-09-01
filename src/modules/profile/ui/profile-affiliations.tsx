import type { Profile, ProfileListItem } from '@/modules/profile';

// "Affiliations"-style summary built from whichever structured Profile fields are non-null —
// About no longer carries a publications list (moved to its own tab), so this is the only
// structured content on the About tab besides the free-text bio/research statement.
//
// Laid out as a single stacked column rather than a two-column grid: these sections hold CV
// entries of wildly different lengths (two awards next to seven fellowships), and side-by-side
// columns left the eye with no reliable cue for where one section ended and the next began — the
// exact problem this layout is meant to solve. Each section opens with a full-width rule, so the
// boundaries are unambiguous at any viewport width.
//
// Section headings are set in the serif at reading size, not as uppercase letter-spaced labels.
// Every heading on the site used to be all-caps with wide tracking, which flattened the hierarchy
// (a section heading looked identical to a metadata label) and is markedly harder to read — all-
// caps removes the word-shape cue that fluent reading depends on.

const LIST_FIELDS = [
  'education',
  'fellowshipsVisiting',
  'teachingRoles',
  'teachingAwards',
  'scholarshipsTravelAwards',
  'researchInterests',
  'invitedTalks',
] as const satisfies readonly (keyof Profile)[];

const LIST_FIELD_LABELS: Record<(typeof LIST_FIELDS)[number], string> = {
  education: 'Education',
  fellowshipsVisiting: 'Fellowships & visiting appointments',
  teachingRoles: 'Teaching roles',
  teachingAwards: 'Teaching awards',
  scholarshipsTravelAwards: 'Scholarships & travel awards',
  researchInterests: 'Research interests',
  invitedTalks: 'Invited talks',
};

function ListSection({
  id,
  heading,
  items,
}: {
  id: string;
  heading: string;
  items: ProfileListItem[];
}) {
  const headingId = `profile-section-${id}`;

  return (
    <section aria-labelledby={headingId} className="border-t border-border pt-8">
      <h3 id={headingId} className="font-serif text-xl text-foreground">
        {heading}
      </h3>

      <ul className="mt-5 space-y-5">
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key -- items have no stable id in this Json-list field
          <li key={index} className="text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <span className="text-pretty font-medium leading-snug text-foreground">
                {item.title}
              </span>
              {/* Tabular figures so the year column stays in a straight line down the list
                  instead of ragging with each entry's digit widths. */}
              {item.year && (
                <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">
                  {item.year}
                </span>
              )}
            </div>
            {item.subtitle && (
              <p className="mt-0.5 max-w-[62ch] text-pretty leading-relaxed text-muted-foreground">
                {item.subtitle}
              </p>
            )}
            {item.description && (
              <p className="mt-1 max-w-[62ch] text-pretty leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProfileAffiliations({ profile }: { profile: Profile }) {
  type Section = { field: string; heading: string; items: ProfileListItem[] };

  const sections = LIST_FIELDS.map(
    (field): Section => ({
      field,
      heading: LIST_FIELD_LABELS[field],
      items: (profile[field] as ProfileListItem[] | null) ?? [],
    }),
  ).filter((section): section is Section => section.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <ListSection
          key={section.field}
          id={section.field}
          heading={section.heading}
          items={section.items}
        />
      ))}
    </div>
  );
}
