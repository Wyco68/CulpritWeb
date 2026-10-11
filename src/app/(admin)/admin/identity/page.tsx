import type { Metadata } from 'next';
import { getProfileCached } from '@/modules/profile';
import { ProfileFieldsForm } from '@/modules/profile/ui/profile-fields-form';
import { AdminScreen } from '../_components/admin-screen';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Identity' };
}

// The lab's name, tagline and affiliation, which head every public page. This was the About
// screen until the public About tab was removed (2026-10-11); the director's card now lives on the
// Team tab, built from the member flagged Director on /admin/team (ADR-016).
const PROFILE_SECTIONS = [
  {
    id: 'identity',
    title: 'Identity',
    description: 'The name, tagline and affiliation at the head of every public page.',
    fields: ['labName', 'labTagline', 'positionAffiliation'],
  },
] as const;

export default async function AdminIdentityPage() {
  const profileResult = await getProfileCached();

  return (
    <AdminScreen title="Identity" intro="The lab's name and affiliation in the site header.">
      <ProfileFieldsForm
        profile={profileResult.ok ? profileResult.data : null}
        sections={PROFILE_SECTIONS}
      />
    </AdminScreen>
  );
}
