import { useTranslations } from 'next-intl';
import type { Profile, ProfileListItem } from '@/modules/profile';

// "Affiliations"-style summary built from whichever structured Profile fields are non-null —
// About no longer carries a publications list (moved to its own tab), so this is the only
// structured content on the About tab besides the free-text bio/research statement.

const LIST_FIELDS = [
  'education',
  'fellowshipsVisiting',
  'teachingRoles',
  'teachingAwards',
  'scholarshipsTravelAwards',
  'researchInterests',
  'invitedTalks',
] as const satisfies readonly (keyof Profile)[];

function ListSection({ heading, items }: { heading: string; items: ProfileListItem[] }) {
  return (
    <section aria-labelledby={`profile-${heading}`}>
      <h3 id={`profile-${heading}`} className="text-sm font-semibold tracking-tight text-foreground">
        {heading}
      </h3>
      <ul className="mt-3 space-y-3">
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key -- items have no stable id in this Json-list field
          <li key={index} className="text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="font-medium text-foreground">{item.title}</span>
              {item.year && (
                <span className="font-mono text-xs text-muted-foreground">{item.year}</span>
              )}
            </div>
            {item.subtitle && <p className="text-muted-foreground">{item.subtitle}</p>}
            {item.description && (
              <p className="mt-0.5 text-muted-foreground">{item.description}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProfileAffiliations({ profile }: { profile: Profile }) {
  const t = useTranslations('about.fields');

  type Section = { field: string; heading: string; items: ProfileListItem[] };

  const sections = LIST_FIELDS.map(
    (field): Section => ({
      field,
      heading: t(field),
      items: (profile[field] as ProfileListItem[] | null) ?? [],
    }),
  ).filter((section): section is Section => section.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {sections.map((section) => (
        <ListSection key={section.field} heading={section.heading} items={section.items} />
      ))}
    </div>
  );
}
