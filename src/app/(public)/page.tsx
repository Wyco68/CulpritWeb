import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, GraduationCap } from 'lucide-react';

import { getProfileCached } from '@/modules/profile';
import { getTeamMemberService, memberInitials } from '@/modules/research-groups';
import { Avatar } from '@/modules/shared/ui/avatar';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { toMetaDescription } from './_lib/page-meta';

const FALLBACK_DESCRIPTION = 'About the lab, its work, and its director.';

export async function generateMetadata(): Promise<Metadata> {
  const result = await getProfileCached();

  return {
    title: 'About',
    description: toMetaDescription(
      result.ok ? result.data?.labOverview : null,
      FALLBACK_DESCRIPTION,
    ),
  };
}

export default async function AboutPage() {
  // The lab overview plus a card for the director (ADR-016). Her CV lives on her own profile page,
  // which the card links to; her external links are her `member_link` rows, edited in the admin.
  const [profileResult, directorResult] = await Promise.all([
    getProfileCached(),
    getTeamMemberService().findDirectorProfile(),
  ]);

  const overview = profileResult.ok ? profileResult.data?.labOverview : null;
  const directorProfile = directorResult.ok ? directorResult.data : null;
  const pill =
    'inline-flex items-center gap-1.5 rounded-full border border-border bg-masthead px-3 py-1.5 text-sm font-medium text-accent-on-band transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

  return (
    <div>
      <PageHeading title="About" />

      {!overview && !directorProfile ? (
        <EmptyState title="Nothing here yet" className="mt-10" />
      ) : (
        <div className="mt-12 space-y-12">
          {overview && (
            <p className="rise max-w-[62ch] whitespace-pre-line text-pretty break-words font-serif text-lg leading-[1.75] text-foreground sm:text-xl">
              {overview}
            </p>
          )}

          {directorProfile && (
            <section
              aria-labelledby="about-director"
              className="flex max-w-3xl flex-col gap-6 rounded-xl border border-border bg-surface p-7 shadow-sm sm:flex-row sm:items-center sm:gap-8"
            >
              <Avatar
                src={directorProfile.member.photoUrl}
                alt={`Portrait of ${directorProfile.member.name}`}
                fallback={memberInitials(directorProfile.member.name)}
                size="lg"
                shape="circle"
              />
              <div className="min-w-0">
                <h3
                  id="about-director"
                  className="break-words font-mono text-xs font-semibold uppercase tracking-[0.12em] text-accent"
                >
                  Lab director · {directorProfile.member.role}
                </h3>
                <p className="mt-2 break-words text-3xl font-bold leading-tight tracking-[-0.02em] text-foreground">
                  {directorProfile.member.name}
                </p>
                {directorProfile.member.affiliation && (
                  <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">
                    {directorProfile.member.affiliation}
                  </p>
                )}

                <ul className="mt-4 flex flex-wrap gap-2">
                  <li>
                    <Link href={`/team/${directorProfile.member.id}`} className={pill}>
                      <GraduationCap className="size-3.5" aria-hidden="true" />
                      Profile
                    </Link>
                  </li>
                  {directorProfile.links.map((link) => (
                    <li key={link.id}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className={pill}>
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        {link.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
