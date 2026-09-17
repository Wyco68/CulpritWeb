import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  FileText,
  FlaskConical,
  History,
  ImageOff,
  Link2,
  Users2,
  type LucideIcon,
} from 'lucide-react';
import { requireAdmin } from '@/modules/auth';
import { getResearchService } from '@/modules/research';
import { getPublicationService } from '@/modules/publications';
import { getTeamMemberService } from '@/modules/research-groups';
import { getEventService } from '@/modules/events';
import { getCourseService } from '@/modules/teaching';
import { unwrapOr } from '@/modules/shared/lib/result';
import { INSTITUTION_TIME_ZONE } from '@/modules/shared/lib/timezone';
import { buttonVariants } from '@/modules/shared/ui/button';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { StatusPill, type Status } from '@/modules/shared/ui/status-pill';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin Dashboard' };
}

// The admin home: four headline figures, what on the public site still needs filling in, and what
// changed most recently. Every number is a count of rows the admin entered — no trend percentages, no invented
// comparisons. A figure's small note is another real fact (this year's count, the next date), not
// decoration.
//
// Counts come from each module's SQL `stats()`. The recent-changes list reads the four content
// lists and keeps the five newest edits.
// ponytail: full list() reads for five rows — fine at tens of rows per table; add a per-module
// `recent(limit)` query if any list grows into the hundreds.

const dateFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: INSTITUTION_TIME_ZONE,
});

const shortDateFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  timeZone: INSTITUTION_TIME_ZONE,
});

/** One gap in the published content: how many records share it, and where to fix them. */
type AttentionItem = {
  key: string;
  count: number;
  label: string;
  icon: LucideIcon;
  href: string;
};

type RecentChange = {
  key: string;
  title: string;
  kind: string;
  icon: LucideIcon;
  href: string;
  updatedAt: Date;
  status: Status;
};

export default async function AdminDashboardPage() {
  const now = new Date();
  const [
    session,
    research,
    publications,
    teamMembers,
    events,
    courses,
    publicationStats,
    eventStats,
    researchStats,
  ] = await Promise.all([
    requireAdmin(),
    getResearchService().list(),
    getPublicationService().list(),
    getTeamMemberService().list(),
    getEventService().list(),
    getCourseService().stats(),
    getPublicationService().stats(),
    getEventService().stats(),
    getResearchService().stats(),
  ]);

  const adminName = session.ok ? session.data.name.split(' ')[0] : null;
  const researchRows = unwrapOr(research, []);
  const publicationRows = unwrapOr(publications, []);
  const memberRows = unwrapOr(teamMembers, []);
  const eventRows = unwrapOr(events, []);
  const courseCount = unwrapOr(courses, { total: 0 }).total;
  const pubStats = unwrapOr(publicationStats, { total: 0, byYear: [], latestYear: null });
  const evStats = unwrapOr(eventStats, { total: 0, upcoming: 0, nextEventDate: null });
  const areaCount = unwrapOr(researchStats, { total: 0, byArea: [] }).byArea.length;

  // Gaps a visitor would actually notice, each computed from rows already loaded: a publication a
  // reader can't open, a member card showing initials instead of a face, an event with no photos
  // or video to show. Zero-count gaps are dropped, so the panel only lists work left to do.
  const attention: AttentionItem[] = [
    {
      key: 'publication-links',
      count: publicationRows.filter((row) => !row.link).length,
      label: 'publication',
      icon: FileText,
      href: '/admin/publications',
    },
    {
      key: 'member-photos',
      count: memberRows.filter((row) => !row.photoUrl).length,
      label: 'team member',
      icon: Users2,
      href: '/admin/team',
    },
    {
      key: 'event-media',
      count: eventRows.filter((row) => row.photoUrls.length === 0 && row.videoUrls.length === 0)
        .length,
      label: 'event',
      icon: ImageOff,
      href: '/admin/events',
    },
  ].filter((item) => item.count > 0);
  const attentionText: Record<string, (count: number) => string> = {
    'publication-links': (n) => `${n} ${n === 1 ? 'publication has' : 'publications have'} no link`,
    'member-photos': (n) => `${n} ${n === 1 ? 'team member has' : 'team members have'} no photo`,
    'event-media': (n) => `${n} ${n === 1 ? 'event has' : 'events have'} no photos or video`,
  };
  const thisYear = Number(
    new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: INSTITUTION_TIME_ZONE }).format(now),
  );
  const publishedThisYear = pubStats.byYear.find((row) => row.year === thisYear)?.count ?? 0;

  const recent: RecentChange[] = [
    ...publicationRows.map((row) => ({
      key: `publication-${row.id}`,
      title: row.title,
      kind: 'Publication',
      icon: FileText,
      href: '/admin/publications',
      updatedAt: row.updatedAt,
      status: row.link
        ? ({ tone: 'ok', label: 'Linked', icon: Link2 } as const)
        : ({ tone: 'attention', label: 'No link' } as const),
    })),
    ...researchRows.map((row) => ({
      key: `research-${row.id}`,
      title: row.title,
      kind: 'Research',
      icon: FlaskConical,
      href: '/admin/research',
      updatedAt: row.updatedAt,
      status: row.link
        ? ({ tone: 'ok', label: 'Linked', icon: Link2 } as const)
        : ({ tone: 'neutral', label: 'No link' } as const),
    })),
    ...eventRows.map((row) => ({
      key: `event-${row.id}`,
      title: row.title,
      kind: 'Event',
      icon: CalendarDays,
      href: '/admin/events',
      updatedAt: row.updatedAt,
      status:
        row.eventDate.getTime() >= now.getTime()
          ? ({ tone: 'ok', label: 'Upcoming', icon: CalendarClock } as const)
          : ({ tone: 'neutral', label: 'Past', icon: History } as const),
    })),
    ...memberRows.map((row) => ({
      key: `member-${row.id}`,
      title: row.name,
      kind: 'Team member',
      icon: Users2,
      href: `/admin/team/${row.id}`,
      updatedAt: row.updatedAt,
      status: row.photoUrl
        ? ({ tone: 'ok', label: 'Has photo' } as const)
        : ({ tone: 'attention', label: 'No photo' } as const),
    })),
  ]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <PageHeading
        as="h1"
        title="Dashboard"
        intro={adminName ? `Welcome back, ${adminName}.` : undefined}
        action={
          <Link href="/" className={buttonVariants({ variant: 'outline' })}>
            View public site
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          href="/admin/publications"
          icon={FileText}
          label="Publications"
          value={pubStats.total}
          note={publishedThisYear > 0 ? `${publishedThisYear} in ${thisYear}` : undefined}
        />
        <Figure
          href="/admin/research"
          icon={FlaskConical}
          label="Research works"
          value={researchRows.length}
          note={areaCount > 0 ? `${areaCount} ${areaCount === 1 ? 'area' : 'areas'}` : undefined}
        />
        <Figure
          href="/admin/team"
          icon={Users2}
          label="Team members"
          value={memberRows.length}
          note={
            courseCount > 0
              ? `${courseCount} ${courseCount === 1 ? 'course' : 'courses'}`
              : undefined
          }
        />
        <Figure
          href="/admin/events"
          icon={CalendarClock}
          label="Upcoming events"
          value={evStats.upcoming}
          note={
            evStats.nextEventDate
              ? `Next ${shortDateFormatter.format(evStats.nextEventDate)}`
              : `${evStats.total} in total`
          }
        />
      </dl>

      <Panel
        title="Needs attention"
        note={attention.length > 0 ? `${attention.length} to review` : undefined}
      >
        {attention.length === 0 ? (
          <p className="flex items-center gap-2.5 text-sm text-foreground">
            <CheckCircle2 className="size-4 text-accent" aria-hidden="true" />
            Every publication has a link, every member a photo, every event some media.
          </p>
        ) : (
          <ul className="-mx-6 -my-6 divide-y divide-border">
            {attention.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-3 px-6 py-3.5 text-sm text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-surface">
                    <item.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">{attentionText[item.key](item.count)}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                    Review
                    <ArrowRight
                      className="size-3.5 transition-[translate] duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Recently updated">
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Records appear here as they are added or edited.
          </p>
        ) : (
          <ul className="-mx-6 -my-6 divide-y divide-border">
            {recent.map((change) => (
              <li
                key={change.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-6 py-3.5 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto]"
              >
                <Link
                  href={change.href}
                  className="flex min-w-0 items-center gap-3 rounded-xs text-sm font-medium text-foreground hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <change.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 truncate">{change.title}</span>
                </Link>
                <span className="hidden text-sm text-muted-foreground sm:block">{change.kind}</span>
                <time
                  dateTime={change.updatedAt.toISOString()}
                  className="tabular hidden text-sm text-muted-foreground sm:block"
                >
                  {dateFormatter.format(change.updatedAt)}
                </time>
                <StatusPill status={change.status} className="justify-self-end" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/** A headline count, linking into the screen that manages it. */
function Figure({
  href,
  icon: Icon,
  label,
  value,
  note,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
  note?: string;
}) {
  return (
    // `relative` + the link's `after` overlay make the whole tile the hit target, while keeping
    // exactly one focusable element with one accessible name inside the dl/dt/dd structure.
    <div className="group relative rounded-lg border border-border-strong bg-surface p-5 shadow-hairline transition-colors duration-300 ease-[var(--ease-out-expo)] hover:border-accent/40 has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring">
      <dt className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span className="inline-flex size-8 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {label}
      </dt>
      <dd className="mt-4">
        <Link
          href={href}
          aria-label={`${label}: ${value}`}
          className="tabular inline-block rounded-xs text-3xl font-bold leading-none tracking-[-0.02em] text-foreground transition-colors duration-300 ease-[var(--ease-out-expo)] after:absolute after:inset-0 after:content-[''] group-hover:text-accent focus-visible:outline-none"
        >
          {value}
        </Link>
        {note && (
          <p className="mt-3 inline-flex rounded-pill bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {note}
          </p>
        )}
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
    <section className="overflow-hidden rounded-lg border border-border-strong bg-surface shadow-hairline">
      <div className="flex items-baseline justify-between gap-4 border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {note && <span className="font-mono text-xs text-muted-foreground">{note}</span>}
      </div>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}
