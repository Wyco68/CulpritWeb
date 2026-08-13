import type { Metadata } from 'next';
import { FileText, FlaskConical, Users2, Building2, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/modules/shared/ui/card';
import { getResearchService } from '@/modules/research';
import { getPublicationService } from '@/modules/publications';
import { getResearchGroupService, getTeamMemberService } from '@/modules/research-groups';
import { getAppointmentService } from '@/modules/appointments';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Admin Dashboard' };
}

// The dashboard is deliberately light: at-a-glance counts (fetched directly through each
// module's service — a Server Component read, no client round trip needed), each card doubling
// as a link into that section's "Set Information" / "Manage Appointments" page. Nothing here is
// itself editable.
export default async function AdminDashboardPage() {
  const [research, publications, groups, teamMembers, scheduled] = await Promise.all([
    getResearchService().list(),
    getPublicationService().list(),
    getResearchGroupService().list(),
    getTeamMemberService().list(),
    // Every appointment is admin-declared, so there is no pending-review queue anymore — the one
    // remaining count worth showing is how many are still scheduled (not yet cancelled).
    getAppointmentService().list({ status: 'scheduled' }),
  ]);

  const stats = [
    {
      href: '/admin/research',
      label: 'Research works',
      icon: FlaskConical,
      value: research.ok ? research.data.length : 0,
    },
    {
      href: '/admin/publications',
      label: 'Publications',
      icon: FileText,
      value: publications.ok ? publications.data.length : 0,
    },
    {
      href: '/admin/groups',
      label: 'Research groups',
      icon: Building2,
      value: groups.ok ? groups.data.length : 0,
    },
    {
      href: '/admin/team-members',
      label: 'Team members',
      icon: Users2,
      value: teamMembers.ok ? teamMembers.data.length : 0,
    },
    {
      href: '/admin/appointments',
      label: 'Scheduled appointments',
      icon: CalendarClock,
      value: scheduled.ok ? scheduled.data.length : 0,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A quick overview of the site&apos;s content.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ href, label, icon: Icon, value }) => (
          <Link
            key={label}
            href={href}
            className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Card className="h-full transition-colors hover:border-accent/50 hover:bg-muted/40">
              <CardContent className="flex flex-col gap-2 p-4">
                <Icon className="size-4 text-accent" aria-hidden="true" />
                <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
