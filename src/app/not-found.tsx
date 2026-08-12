import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { getProfileCached } from '@/modules/profile';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { SiteHeader } from './(public)/_components/site-header';

// Root-level not-found — Next renders this for any unmatched route across the whole app (public
// and admin alike), so it lives outside the `(public)` route group and can't inherit that group's
// layout. It reproduces the same navy header + nav tabs by fetching the profile itself, matching
// the visual language of every other page instead of falling back to Next's bare default, and
// gives a lost visitor (public or admin) a real way back into the site.

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const result = await getProfileCached();
  const profile = result.ok ? result.data : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:py-16">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Page not found</h2>

        <EmptyState
          icon={Compass}
          title="We couldn't find that page"
          description="The page you're looking for doesn't exist or may have moved. Use the tabs above or the link below to keep browsing."
          className="mt-8"
        />

        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-6 text-sm font-medium tracking-tight text-accent-foreground transition-colors hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Back to homepage
          </Link>
        </div>
      </main>
    </div>
  );
}
