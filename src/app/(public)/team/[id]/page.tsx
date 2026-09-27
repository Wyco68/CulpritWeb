import { cache } from 'react';
import type { Metadata } from 'next';
// Prefetches on hover/focus rather than on sight — see intent-link.tsx.
import { IntentLink as Link } from '@/modules/shared/ui/intent-link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ProjectList } from '@/modules/projects';
import { getPublicationService } from '@/modules/publications';
import { getResearchService } from '@/modules/research';
import {
  CreditedWorkList,
  getTeamMemberService,
  isMemberByline,
  MemberCard,
  PROFILE_SECTION_LABELS,
  PROFILE_SECTIONS,
  showsSection,
  type CreditedWork,
  type ProfileSection,
} from '@/modules/research-groups';
import {
  CourseList,
  CV_SECTIONS,
  CvEntryList,
  groupByLevel,
  groupBySection,
  type CvSection,
} from '@/modules/teaching';
import { cvSectionAnchorId } from '@/modules/teaching/ui/cv-entry-list';
import { SectionNav, type SectionNavItem } from '@/modules/shared/ui/section-nav';
import { toMetaDescription } from '../../_lib/page-meta';
import { SectionHeading, Standfirst } from '@/modules/shared/ui/prose';

type Props = { params: Promise<{ id: string }> };

// Request-scoped, so generateMetadata and the page share one read.
const loadProfile = cache(async (id: string) => {
  const result = await getTeamMemberService().findProfile(id);
  return result.ok ? result.data : null;
});

/**
 * The research items and publications this member is credited on.
 *
 * Resolved here, at render time, against the full lists: a byline carries no link to a member
 * (ADR-016), so the match is `isMemberByline` over names. Both lists are the lab's whole output —
 * tens of rows, already read on their own tabs — so filtering two arrays in the page is cheaper
 * than a per-member query, and it is skipped entirely when the admin has hidden both sections for
 * this member (ADR-020) — a name collision must not manufacture a publication list for an engineer.
 *
 * Each row links back to its tab rather than repeating the entry. Publications carry a year anchor,
 * which the year rail on /publications renders for every year that has rows; research areas are
 * ordered by the admin's arrangement and their anchors are positional, so those rows land on the
 * works section instead of guessing an index.
 */
async function creditedWorks(member: { name: string; citationName: string | null }) {
  const [researchResult, publicationsResult] = await Promise.all([
    getResearchService().list(),
    getPublicationService().list(),
  ]);

  const research: CreditedWork[] = (researchResult.ok ? researchResult.data : [])
    .filter((item) => item.contributors.some((c) => isMemberByline(member, c.name)))
    .map((item) => ({ id: item.id, title: item.title, meta: item.area, href: '/research#works' }));

  const publications: CreditedWork[] = (publicationsResult.ok ? publicationsResult.data : [])
    .filter((item) => item.authors.some((author) => isMemberByline(member, author.name)))
    .map((item) => ({
      id: item.id,
      title: item.title,
      meta: `${item.venue}, ${item.year}`,
      href: `/publications#publications-${item.year}`,
    }));

  return { research, publications };
}

// Prerender every member's profile at build time so these pages join the Full Route Cache with the
// rest of the public site. Without this the route builds as Dynamic and is re-rendered — and
// re-queried — on every visit, which also left the `/team/[id]` template purges in
// shared/lib/revalidate as dead calls: there was no cache entry for them to drop.
// `dynamicParams` keeps its default, so a member added after the build still renders on demand and
// is cached from then on.
export async function generateStaticParams() {
  const result = await getTeamMemberService().list();
  return result.ok ? result.data.map((member) => ({ id: member.id })) : [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await loadProfile((await params).id);
  if (!profile) return { title: 'Team member not found', robots: { index: false } };
  const { member } = profile;
  return {
    title: member.name,
    description: toMetaDescription(member.bio, `${member.name}, ${member.role}.`),
  };
}

export default async function TeamMemberPage({ params }: Props) {
  const profile = await loadProfile((await params).id);
  if (!profile) notFound();

  // The CV, course and project arrays are already filtered by the member's hidden sections in the
  // service. Research and publications are resolved here from bylines, so they are checked here.
  const { member, links, cvEntries, courses, projects } = profile;
  const showsCredits = showsSection(member, 'research') || showsSection(member, 'publications');
  const credited = showsCredits ? await creditedWorks(member) : { research: [], publications: [] };
  const research = showsSection(member, 'research') ? credited.research : [];
  const publications = showsSection(member, 'publications') ? credited.publications : [];

  const cvGroups = new Map(
    groupBySection(cvEntries, CV_SECTIONS).map((group) => [group.section, group]),
  );
  const courseGroups = groupByLevel(courses);

  // Every section with content, in PROFILE_SECTIONS order — most important first. The page and its
  // jump list are both built from this one list, so they can never disagree about the order.
  const blocks = PROFILE_SECTIONS.flatMap((section): Block[] => {
    if (isCvSection(section)) {
      const group = cvGroups.get(section);
      // CvEntryList renders its own <section>, heading and anchor id.
      return group
        ? [{ section, id: cvSectionAnchorId(section), content: <CvEntryList groups={[group]} /> }]
        : [];
    }
    const content = {
      publications: publications.length > 0 && <CreditedWorkList items={publications} />,
      research: research.length > 0 && <CreditedWorkList items={research} />,
      projects: projects.length > 0 && <ProjectList projects={projects} />,
      courses: courseGroups.length > 0 && <CourseList groups={courseGroups} />,
    }[section];
    return content
      ? [
          {
            section,
            id: section,
            content: <TitledSection section={section}>{content}</TitledSection>,
          },
        ]
      : [];
  });

  const sections: SectionNavItem[] = [
    ...(member.bio ? [{ id: 'biography', label: 'Biography' }] : []),
    ...blocks.map((block) => ({ id: block.id, label: PROFILE_SECTION_LABELS[block.section] })),
  ];

  return (
    <div>
      <Link
        href="/team"
        className="mb-8 inline-flex items-center gap-2 rounded-sm text-sm tracking-tight text-muted-foreground transition-colors duration-300 ease-[var(--ease-out-expo)] hover:text-foreground focus-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to Team
      </Link>

      <MemberCard
        member={member}
        links={links}
        eyebrow={member.isDirector ? `Lab Director · ${member.role}` : undefined}
        as="h2"
      />

      <div className="mt-12 space-y-10">
        <SectionNav items={sections} />

        {member.bio && (
          <section id="biography" aria-label="Biography">
            <Standfirst preserveLines>{member.bio}</Standfirst>
          </section>
        )}

        {/* One rule between sections, whatever renders them. */}
        {blocks.length > 0 && (
          <div className="divide-y divide-border [&>*]:py-10 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
            {blocks.map((block) => (
              <div key={block.section}>{block.content}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type Block = { section: ProfileSection; id: string; content: React.ReactNode };

const CV_SECTION_SET: ReadonlySet<string> = new Set(CV_SECTIONS);

function isCvSection(section: ProfileSection): section is ProfileSection & CvSection {
  return CV_SECTION_SET.has(section);
}

/**
 * A non-CV section, headed exactly like the CV section headings so the page reads as one sequence
 * of sections rather than two families of them.
 */
function TitledSection({
  section,
  children,
}: {
  section: Exclude<ProfileSection, CvSection>;
  children: React.ReactNode;
}) {
  const headingId = `${section}-heading`;
  return (
    <section id={section} aria-labelledby={headingId}>
      <SectionHeading id={headingId}>{PROFILE_SECTION_LABELS[section]}</SectionHeading>
      <div className="mt-5">{children}</div>
    </section>
  );
}
