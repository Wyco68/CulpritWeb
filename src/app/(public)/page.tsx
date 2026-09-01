import type { Metadata } from 'next';
import { getProfileCached, ProfileAffiliations, ProfileLinks } from '@/modules/profile';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';

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
      <PageHeading title="About" />

      {!result.ok || !result.data ? (
        <EmptyState
          title="Profile not available"
          className="mt-10"
        />
      ) : (
        <div className="mt-12 space-y-10">
          {/* The lead paragraph, set in the reading serif one step up from body size. It is the
              first prose on the site and the thing most visitors actually came for, so it is
              given the weight of a standfirst rather than the grey of secondary copy. */}
          {result.data.bio && (
            <p className="rise max-w-[62ch] text-pretty font-serif text-lg leading-[1.75] text-foreground sm:text-xl">
              {result.data.bio}
            </p>
          )}

          <ProfileLinks profile={result.data} />

          {result.data.researchStatement && (
            <section
              aria-labelledby="research-statement-heading"
              className="border-t border-border pt-8"
            >
              <h3
                id="research-statement-heading"
                className="font-serif text-xl text-foreground"
              >
                Research statement
              </h3>
              <p className="mt-4 max-w-[62ch] text-pretty leading-[1.75] text-muted-foreground">
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
