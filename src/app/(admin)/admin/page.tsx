import type { Metadata } from 'next';
import Link from 'next/link';
import { getProfileCached } from '@/modules/profile';
import { getResearchService } from '@/modules/research';
import { getPublicationService } from '@/modules/publications';
import { getResearchGroupService, getTeamMemberService } from '@/modules/research-groups';
import { getEventService, splitByTiming } from '@/modules/events';
import { INSTITUTION_TIME_ZONE } from '@/modules/shared/lib/timezone';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { YearColumns, DistributionBars, CompletenessMeter } from './_components/charts';
import type { YearDatum } from './_components/charts';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin Dashboard' };
}

// The dashboard reports on what is actually published, using only fields the admin has already
// entered — publication years, research areas, group membership, event dates. Nothing here
// is a vanity metric or an invented number; if the data isn't in the database, the panel isn't
// rendered at all.
//
// The forms follow from the data's job rather than from what looks impressive: output over time is
// a column chart, magnitude across named categories is a horizontal bar, a ratio against a ceiling
// is a meter, and a lone number is just a number. Each is a single series in one hue, so length
// carries the magnitude and colour carries nothing.
//
// Reads go through each module's service (a Server Component read, no client round trip). The
// aggregation is done here in memory rather than as new repository queries: these are tens of
// rows, not thousands, and it keeps Prisma where it belongs.

/** The structured profile fields that together make a complete public About tab. */
const PROFILE_SECTIONS = [
  'photoUrl',
  'bio',
  'researchStatement',
  'positionAffiliation',
  'education',
  'fellowshipsVisiting',
  'teachingRoles',
  'teachingAwards',
  'scholarshipsTravelAwards',
  'researchInterests',
  'invitedTalks',
] as const;

/** Counts per year, keeping the empty years in between — a gap in output is itself information. */
function toYearSeries(years: number[]): YearDatum[] {
  if (years.length === 0) return [];
  const counts = new Map<number, number>();
  for (const year of years) counts.set(year, (counts.get(year) ?? 0) + 1);
  const min = Math.min(...years);
  const max = Math.max(...years);
  // Bound the span: one mistyped year would otherwise generate thousands of empty slots.
  const from = Math.max(min, max - 19);
  return Array.from({ length: max - from + 1 }, (_, index) => ({
    year: from + index,
    count: counts.get(from + index) ?? 0,
  }));
}

function tally(values: string[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count }));
}

export default async function AdminDashboardPage() {
  const [profileResult, research, publications, groups, teamMembers, events] = await Promise.all([
    getProfileCached(),
    getResearchService().list(),
    getPublicationService().list(),
    getResearchGroupService().list(),
    getTeamMemberService().list(),
    getEventService().list(),
  ]);

  const profile = profileResult.ok ? profileResult.data : null;
  const researchItems = research.ok ? research.data : [];
  const publicationItems = publications.ok ? publications.data : [];
  const groupItems = groups.ok ? groups.data : [];
  const memberItems = teamMembers.ok ? teamMembers.data : [];
  const eventItems = events.ok ? events.data : [];

  const years = toYearSeries(publicationItems.map((item) => item.year));
  const byArea = tally(researchItems.map((item) => item.area));

  const byGroup = groupItems.map((group) => ({
    label: group.name,
    count: group.teamMembers.length,
  }));
  const ungrouped = memberItems.filter((member) => member.researchGroupId === null).length;
  if (ungrouped > 0) byGroup.push({ label: 'No group', count: ungrouped });

  // Same split the public tab uses, so the two never disagree about what counts as upcoming.
  const { upcoming } = splitByTiming(eventItems);

  const filledSections = profile
    ? PROFILE_SECTIONS.filter((field) => {
        const value = profile[field];
        return Array.isArray(value) ? value.length > 0 : Boolean(value);
      }).length
    : 0;

  const nextDate = upcoming[0]
    ? new Intl.DateTimeFormat('en', {
        day: '2-digit',
        month: 'short',
        timeZone: INSTITUTION_TIME_ZONE,
      }).format(upcoming[0].eventDate)
    : null;

  const latestYear =
    publicationItems.length > 0 ? Math.max(...publicationItems.map((item) => item.year)) : null;

  return (
    <div className="flex flex-col gap-12">
      <PageHeading as="h1" title="Dashboard" />

      {/* Headline counts. A number with a label is the right form for a single current value — a
          one-bar chart would say the same thing with more ink. */}
      <dl className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
        <Figure href="/admin/publications" label="Publications" value={publicationItems.length} />
        <Figure href="/admin/research" label="Research" value={researchItems.length} />
        <Figure href="/admin/team-members" label="People" value={memberItems.length} />
        <Figure
          href="/admin/events"
          label="Upcoming"
          value={upcoming.length}
          note={nextDate ? `next ${nextDate}` : undefined}
        />
      </dl>

      {years.length > 0 && (
        <Panel title="Output by year" note={latestYear ? `latest ${latestYear}` : undefined}>
          <YearColumns data={years} />
        </Panel>
      )}

      <div className="grid gap-12 lg:grid-cols-2">
        {byArea.length > 0 && (
          <Panel title="Research areas">
            <DistributionBars data={byArea} />
          </Panel>
        )}

        {byGroup.length > 0 && (
          <Panel title="Group sizes">
            <DistributionBars data={byGroup} />
          </Panel>
        )}

        <Panel
          title="Profile completeness"
          note={filledSections < PROFILE_SECTIONS.length ? 'incomplete' : undefined}
        >
          <CompletenessMeter filled={filledSections} total={PROFILE_SECTIONS.length} />
        </Panel>

        {/* Every event is public now — there is no visibility flag to report on — so the useful
            ratio here is how much of the events list is still ahead rather than already archive. */}
        {eventItems.length > 0 && (
          <Panel title="Events still to come" note={`of ${eventItems.length} total`}>
            <CompletenessMeter filled={upcoming.length} total={eventItems.length} />
          </Panel>
        )}
      </div>
    </div>
  );
}

/** A headline count, linking into the screen that manages it. */
function Figure({
  href,
  label,
  value,
  note,
}: {
  href: string;
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <Link
          href={href}
          className="tabular rounded-xs font-serif text-4xl leading-none text-foreground transition-colors duration-300 ease-[var(--ease-out-expo)] hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {value}
        </Link>
        {note && <p className="mt-1.5 font-mono text-xs text-muted-foreground">{note}</p>}
      </dd>
    </div>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-5">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {note && <span className="font-mono text-xs text-muted-foreground">{note}</span>}
      </div>
      {children}
    </section>
  );
}
