import type { Metadata } from 'next';
import { UserRound } from 'lucide-react';
import { getProfileCached, ProfileAffiliations, ProfileLinks } from '@/modules/profile';
import { EmptyState } from '@/modules/shared/ui/empty-state';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'About',
    description: 'Position, education, fellowships, teaching, and research interests.',
  };
}

export default async function AboutPage() {
  // Same request-scoped read the layout's site header uses — one query serves both.
  const result = await getProfileCached();

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">About</h2>

      {!result.ok || !result.data ? (
        <EmptyState
          icon={UserRound}
          title="Profile information is not available"
          description="Please check back soon."
          className="mt-6"
        />
      ) : (
        <div className="mt-8 space-y-8">
          {result.data.bio && (
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
              {result.data.bio}
            </p>
          )}

          <ProfileLinks profile={result.data} />

          {/* Styled to match the structured sections below (accent rule + uppercase heading) so
              the research statement reads as one of them rather than as stray body copy. */}
          {result.data.researchStatement && (
            <section
              aria-labelledby="research-statement-heading"
              className="border-t border-border pt-6"
            >
              <h3
                id="research-statement-heading"
                className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-widest text-foreground"
              >
                <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                Research statement
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {result.data.researchStatement}
              </p>
            </section>
          )}

          <ProfileAffiliations profile={result.data} />
        </div>
      )}
    </div>
  );
}
