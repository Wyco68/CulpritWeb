import type { Metadata } from 'next';
import { EventsTable, getEventService } from '@/modules/events';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin — Events' };
}

export default async function AdminEventsPage() {
  const result = await getEventService().list();
  const items = result.ok ? result.data : [];

  return <EventsTable items={items} />;
}
