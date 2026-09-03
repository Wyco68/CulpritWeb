import type { Metadata } from 'next';
import { getProfileCached, ProfileFieldsForm } from '@/modules/profile';
import { EventsTable, getEventService } from '@/modules/events';
import { AdminScreen } from '../_components/admin-screen';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Events' };
}

const PROFILE_SECTIONS = [
  {
    id: 'intro',
    title: 'Introduction',
    description: 'Optional prose above the event list on the public tab.',
    fields: ['eventsIntro'],
  },
] as const;

export default async function AdminEventsPage() {
  const [profileResult, result] = await Promise.all([
    getProfileCached(),
    getEventService().list(),
  ]);

  return (
    <AdminScreen title="Events" intro="Everything on the public Events tab.">
      <ProfileFieldsForm
        profile={profileResult.ok ? profileResult.data : null}
        sections={PROFILE_SECTIONS}
      />
      <EventsTable items={result.ok ? result.data : []} />
    </AdminScreen>
  );
}
