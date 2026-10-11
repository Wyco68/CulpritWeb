import type { Metadata } from 'next';
import { getProfileCached } from '@/modules/profile';
import { getTeamMemberService, TeamMembersView } from '@/modules/research-groups';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { LoadErrorState } from '@/modules/shared/ui/error-state';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { Standfirst } from '@/modules/shared/ui/prose';
import { toMetaDescription } from '../_lib/page-meta';

const FALLBACK_DESCRIPTION = 'The people of the lab: director, researchers, and students.';

export async function generateMetadata(): Promise<Metadata> {
  const result = await getProfileCached();
  return {
    title: 'Team',
    description: toMetaDescription(result.ok ? result.data?.teamIntro : null, FALLBACK_DESCRIPTION),
  };
}

export default async function TeamPage() {
  const [membersResult, profileResult] = await Promise.all([
    getTeamMemberService().list(),
    getProfileCached(),
  ]);

  const members = membersResult.ok ? membersResult.data : [];
  // The director's card carries their external links as pills (the list rows don't include links).
  // A failed read just drops the pills; the card and its Profile pill still render.
  const director = members.find((member) => member.isDirector);
  const directorLinksResult = director ? await getTeamMemberService().listLinks(director.id) : null;
  const directorLinks = directorLinksResult?.ok ? directorLinksResult.data : [];
  const intro = profileResult.ok ? profileResult.data?.teamIntro : null;

  return (
    <div>
      <PageHeading title="Team" />

      <div className="mt-12 space-y-10">
        {intro && <Standfirst>{intro}</Standfirst>}

        {!membersResult.ok ? (
          <LoadErrorState what="The team" />
        ) : members.length === 0 ? (
          <EmptyState title="No team members listed yet" />
        ) : (
          <TeamMembersView members={members} directorLinks={directorLinks} />
        )}
      </div>
    </div>
  );
}
