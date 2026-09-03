import type { Metadata } from 'next';
import { getProfileService, ProfileFieldsForm } from '@/modules/profile';
import { getPublicationService, PublicationsTable } from '@/modules/publications';
import { AdminScreen } from '../_components/admin-screen';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Publications' };
}

const PROFILE_SECTIONS = [
  {
    id: 'intro',
    title: 'Introduction',
    description: 'Optional prose above the publication list on the public tab.',
    fields: ['publicationsIntro'],
  },
] as const;

export default async function AdminPublicationsPage() {
  const [profileResult, result] = await Promise.all([
    getProfileService().getProfile(),
    getPublicationService().list(),
  ]);

  return (
    <AdminScreen title="Publications" intro="Everything on the public Publications tab.">
      <ProfileFieldsForm
        profile={profileResult.ok ? profileResult.data : null}
        sections={PROFILE_SECTIONS}
      />
      <PublicationsTable items={result.ok ? result.data : []} />
    </AdminScreen>
  );
}
