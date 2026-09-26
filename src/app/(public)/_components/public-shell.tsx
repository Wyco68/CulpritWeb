import type { ReactNode } from 'react';
import type { Profile } from '@/modules/profile';
import { HeaderCondenser } from './header-condenser';
import { SiteFooter } from './site-footer';
import { DEFAULT_LAB_NAME, SiteHeader, SiteSidebar } from './site-header';

// The frame every public page sits in: the header band across the top, then the navigation
// sidebar (from `lg` up) beside the page and footer. Shared by the (public) layout and the root
// not-found page, which lives outside the route group and so cannot inherit that layout.
//
// `main` is a size container: card grids inside it pick their column count from the width they
// actually get (`@xl:`, `@4xl:`), not from the viewport — beside the sidebar a 1024px screen leaves
// room for two cards, not three.
export function PublicShell({
  profile,
  children,
}: {
  profile: Profile | null;
  children: ReactNode;
}) {
  return (
    // White page body. `--background` is re-pointed at `--surface` for this subtree, so everything
    // that paints the ground (the sticky section nav, dialogs) turns white with it.
    <div className="relative flex min-h-[100dvh] flex-col bg-background [--background:var(--surface)]">
      <HeaderCondenser />
      <SiteHeader profile={profile} />
      {/* Holds the fixed header's full height in the flow from `lg` up. Constant, so condensing the
          header never moves the page. */}
      <div aria-hidden="true" className="hidden h-[var(--header-h-full)] shrink-0 lg:block" />

      <div className="flex-1 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
        <SiteSidebar />

        <div className="flex min-w-0 flex-col">
          {/* `id` is the skip link's target (WCAG 2.4.1). */}
          <main
            id="main"
            className="@container mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-10 sm:px-10 sm:pb-32 sm:pt-14"
          >
            {children}
          </main>
          <SiteFooter
            labName={profile?.labName || DEFAULT_LAB_NAME}
            affiliation={profile?.positionAffiliation}
          />
        </div>
      </div>
    </div>
  );
}
