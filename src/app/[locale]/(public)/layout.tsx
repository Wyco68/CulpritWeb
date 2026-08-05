import { getProfileService } from '@/modules/profile';
import { SiteHeader } from './_components/site-header';

// Shared shell for every public tab (About, Research, Publications, Team Members, Upcoming
// Events, Make Appointment): the navy hero band + tab bar render once here, so each page below
// only supplies its own tab content. Server Component — reads the profile directly through the
// service layer (no internal HTTP round-trip) per the "public read pages fetch through services"
// architecture rule.
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const result = await getProfileService().getProfile();
  const profile = result.ok ? result.data : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:py-16">{children}</main>
    </div>
  );
}
