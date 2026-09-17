import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Mail,
  GraduationCap,
  BookOpen,
  ExternalLink,
} from 'lucide-react';

import { getProfileCached } from '@/modules/profile';
import { getTeamMemberService } from '@/modules/research-groups';
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
  const [profileResult, membersResult] = await Promise.all([
    getProfileCached(),
    getTeamMemberService().list(),
  ]);

  const overview = profileResult.ok
    ? profileResult.data?.labOverview
    : null;

  const director = membersResult.ok
    ? membersResult.data.find((member) => member.isDirector)
    : undefined;

  return (
    <div>
      <PageHeading title="About" />

      {!overview && !director ? (
        <EmptyState title="Nothing here yet" className="mt-10" />
      ) : (
        <div className="mt-12 space-y-12">
          {/* Lab Overview */}
          {overview && (
            <p className="rise max-w-[62ch] whitespace-pre-line text-pretty break-words font-serif text-lg leading-[1.75] text-foreground sm:text-xl">
              {overview}
            </p>
          )}

          {/* Lab Director */}
          {director && (
            <section aria-labelledby="about-director">
              <h3
                id="about-director"
                className="mb-4 font-mono text-xs uppercase tracking-[0.12em] text-emerald-700"
              >
                Lab Director
              </h3>

              <div className="max-w-4xl overflow-hidden rounded-[1.5rem] border border-emerald-100 bg-white shadow-sm">
                <div className="grid md:grid-cols-[220px_1fr]">

                  {/* Director Photo */}
                  <div className="flex h-[300px] items-center justify-center bg-emerald-50 md:h-[320px]">
                    {director.photoUrl ? (
                      <img
                        src={director.photoUrl}
                        alt={`Portrait of ${director.name}`}
                        className="size-52 rounded-full object-cover shadow-sm md:size-60"
                      />
                    ) : (
                      <div className="flex size-52 items-center justify-center rounded-full bg-white text-5xl font-serif text-emerald-700 shadow-sm md:size-60">
                        {director.name
                          .split(' ')
                          .map((name) => name[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                    )}
                  </div>

                  {/* Director Information */}
                  <div className="flex flex-col justify-center p-7 sm:p-8">
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-emerald-700">
                      Lab Director
                    </p>

                    <h2 className="mt-4 break-words font-serif text-3xl font-semibold leading-tight tracking-[-0.025em] text-slate-950">
                      {director.name}
                    </h2>

                    <p className="mt-3 text-lg text-slate-500">
                      {director.role}
                    </p>

                    <div className="mt-6 space-y-1 text-sm leading-relaxed text-slate-500">
                      <p>Department of Computer Engineering</p>
                      <p>Chiang Mai University</p>
                    </div>

                    {/* Links */}
                    <div className="mt-7 flex flex-wrap gap-2.5">

                      {/* Email */}
                      <a
                        href="mailto:jenjira.j@cmu.ac.th"
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 transition hover:bg-emerald-100"
                      >
                        <Mail className="size-4" />
                        Email
                      </a>

                      {/* Profile */}
                      <Link
                        href={`/team/${director.id}`}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 transition hover:bg-emerald-100"
                      >
                        <GraduationCap className="size-4" />
                        Profile
                      </Link>

                      {/* Google Scholar */}
                      <a
                        href="https://scholar.google.com/citations?user=Evff3gsAAAAJ&hl=en"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 transition hover:bg-emerald-100"
                      >
                        <BookOpen className="size-4" />
                        Google Scholar
                      </a>

                      {/* LinkedIn */}
                      <a
                        href="https://www.linkedin.com/in/jenjira-jaimunk-535b7734/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 transition hover:bg-emerald-100"
                      >
                        <ExternalLink className="size-4" />
                        LinkedIn
                      </a>

                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}