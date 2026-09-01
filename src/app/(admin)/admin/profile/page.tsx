import type { Metadata } from 'next';
import { getProfileService, ProfileForm } from '@/modules/profile';
import { PageHeading } from '@/modules/shared/ui/page-heading';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Profile' };
}

// "Set Information — Profile" (PROJECT_SPEC §9.2). Server Component reads the current singleton
// directly through the profile service (same pattern the public About page uses); the interactive
// form + PUT mutation live in the client island below.
export default async function AdminProfilePage() {
  const result = await getProfileService().getProfile();
  const profile = result.ok ? result.data : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeading as="h1" title="Profile" />
      <ProfileForm profile={profile} />
    </div>
  );
}
